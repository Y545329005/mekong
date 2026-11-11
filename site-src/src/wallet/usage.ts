/* ============================================================================
   用量段凭证（展示层 · 资金页专用）
   对齐迅达云 Nexus Meter 的段模型：用量 = 一串时间区间，计费以 duration_seconds
   为准；running 每 5 分钟一段，stopped/suspended 一条长段。带宽计量 = 固定带宽
   × 段时长（Mbps·hr 容量占用口径），无流量字节数。
   本层只做演示态凭证呈现：从流水行确定性拆分三组件并生成段样本，不进账本、
   不持久化、不参与任何资金逻辑。机器规格与费率见 ./specs（引擎同源）。
   ========================================================================== */

import type { LedgerRow, WalletState } from './store'
import { STORE_PER_GB_H, now } from './store'
import { RATE_BW_MBPS_H, specOf } from './specs'

export { RATE_BW_MBPS_H, specOf } from './specs'

/* —— 三组件拆分（金额守恒：gpuFee = amount − bwFee − storageFee） —— */

export type Breakdown = {
  /* gpu=运行费（GPU+带宽拆分）；storage=停机存储长段 */
  kind: 'gpu' | 'storage'
  seconds: number
  gpuFee: number
  bwFee: number
  storageFee: number
  bwMbps: number
  diskGb: number
  segments: UsageSegment[]
}

export type UsageSegment = {
  id: number
  state: 'running' | 'stopped'
  stateZh: '运行' | '关机'
  durationSeconds: number
  bandwidthMbps: number
}

const hashSeed = (s: string) => {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const round4 = (v: number) => +v.toFixed(4)

/** 从流水行拆出用量构成与段样本。非 consume 行返回 null。 */
export function usageBreakdown(row: LedgerRow): Breakdown | null {
  if (row.kind !== 'consume') return null
  const spec = specOf(row.label)
  const seed = hashSeed(row.id)

  if (row.billType === 'storage') {
    /* 停机存储：amount = seconds × diskGb × STORE_PER_GB_H / 3600 */
    const seconds = Math.round(row.amount * 3600 / (spec.diskGb * STORE_PER_GB_H))
    return {
      kind: 'storage', seconds,
      gpuFee: 0, bwFee: 0, storageFee: row.amount,
      bwMbps: spec.bwMbps, diskGb: spec.diskGb,
      segments: [{ id: 100 + seed % 900, state: 'stopped', stateZh: '关机', durationSeconds: seconds, bandwidthMbps: spec.bwMbps }],
    }
  }

  /* 运行费（含种子/订单预付行）：amount = seconds × (dph + bw×RATE) / 3600，
     带宽先计、GPU 吃差额，保证 Σ 严格等于流水金额 */
  const hourly = spec.dph + spec.bwMbps * RATE_BW_MBPS_H
  const seconds = Math.round(row.amount * 3600 / hourly)
  const bwFee = round4(seconds * spec.bwMbps * RATE_BW_MBPS_H / 3600)
  const gpuFee = round4(Math.max(0, row.amount - bwFee))

  /* 段样本（展示层，非全量）：running 300s 切片形态，末段为余数 */
  const baseId = 100 + seed % 900
  const tail = seconds % 300 || 300
  const segments: UsageSegment[] = [
    { id: baseId, state: 'running', stateZh: '运行', durationSeconds: 300, bandwidthMbps: spec.bwMbps },
    { id: baseId + 1, state: 'running', stateZh: '运行', durationSeconds: 300, bandwidthMbps: spec.bwMbps },
    { id: baseId + 2, state: 'running', stateZh: '运行', durationSeconds: 300, bandwidthMbps: spec.bwMbps },
    { id: baseId + 3, state: 'running', stateZh: '运行', durationSeconds: 300, bandwidthMbps: spec.bwMbps },
    { id: baseId + 4, state: 'running', stateZh: '运行', durationSeconds: tail, bandwidthMbps: spec.bwMbps },
  ]
  return {
    kind: 'gpu', seconds, gpuFee, bwFee, storageFee: 0,
    bwMbps: spec.bwMbps, diskGb: spec.diskGb,
    segments,
  }
}

/* —— 近 30 天消费构成（按流水行拆分聚合） —— */

export type Composition = {
  gpu: number; bw: number; storage: number
  total: number
  hasRows: boolean
}

/** 消费构成：按当前账本窗口聚合（演示环境无长期账单存储，窗口内流水即全部可见数据） */
export function monthComposition(wallet: WalletState, days = 30): Composition {
  const since = days > 0 ? now() - days * 86400000 : 0
  const rows = wallet.ledger.filter(r => r.kind === 'consume' && r.at >= since)
  const acc = { gpu: 0, bw: 0, storage: 0 }
  for (const row of rows) {
    const b = usageBreakdown(row)
    if (!b) continue
    acc.gpu += b.gpuFee
    acc.bw += b.bwFee
    acc.storage += b.storageFee
  }
  return {
    gpu: +acc.gpu.toFixed(2),
    bw: +acc.bw.toFixed(2),
    storage: +acc.storage.toFixed(2),
    total: +(acc.gpu + acc.bw + acc.storage).toFixed(2),
    hasRows: rows.length > 0,
  }
}

/* —— 数据新鲜度（演示态：引擎最近推进时刻） —— */

/** 新鲜度戳：引擎 tickAt 优先，无则取最新流水时刻 */
export function asOfAt(wallet: WalletState): number {
  if (wallet.tickAt) return wallet.tickAt
  const latest = wallet.ledger[0]?.at
  return latest ?? now()
}

/** 运行中实例的未落账滚动量（仅按量：acc 为攒计中、未成流的金额） */
export function rollingPending(wallet: WalletState): number {
  return +wallet.orders
    .filter(o => o.contractType === 'ondemand' && (o.status === 'Running' || o.status === 'Rebooting'))
    .reduce((sum, o) => sum + o.acc, 0).toFixed(2)
}

/* —— 展示格式 —— */

/** 3600 → "1h 00m"；305 → "5m 05s" */
export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds % 3600 / 60)
  const s = Math.round(seconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
}
