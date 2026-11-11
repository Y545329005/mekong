/* 宿主机器演示种子（静态快照）
   · 机器编号与型号与资金页演示订单（wallet/store.ts seed）同源：
     「租客租的机器 ⊆ 宿主上架的机器」，两侧演示叙事闭合
   · listed=false 的两台是「名下已登记、尚未挂牌」的机器：上架流程只能从
     这些机器里挑一台挂牌，不会凭空造出一台不存在的物理机器
   · 挂牌价与资源配置取自 wallet/specs.ts 的 MACHINE_SPECS（与计费引擎同一口径），
     市场参考价取自 content.ts 的 marketData（与「价格与行情」页同一挂牌口径）
   · 宿主的上架/下架与调价由 hostStore 按邮箱落盘，不改动本文件基线 */

import { marketData } from './content'
import { MACHINE_SPECS, specOf } from './wallet/specs'

export type HostMachineStatus = 'running' | 'idle'

export type HostMachine = {
  id: string
  gpu: string
  region: 'sg' | 'jp' | 'kr' | 'us'
  status: HostMachineStatus
  /* 种子基线是否已挂牌；宿主的下架/上架在 hostStore 覆盖 */
  listed: boolean
  /* 机器纳入账号的时间（不一定是某一次挂牌的时刻） */
  registeredAt: number
  /* 出租中的租约到期时刻；空闲与未挂牌无此值 */
  leaseEnd?: number
}

const d = 86400000
const h = 3600000

export const HOST_MACHINES: HostMachine[] = [
  { id: 'M-05904012', gpu: 'RTX 5090 ×2', region: 'jp', status: 'running', listed: true, registeredAt: Date.now() - 60 * d, leaseEnd: Date.now() + 3 * d + 6 * h },
  { id: 'M-01114008', gpu: 'A100 ×4', region: 'sg', status: 'running', listed: true, registeredAt: Date.now() - 90 * d, leaseEnd: Date.now() + 12 * d + 4 * h },
  { id: 'M-07730119', gpu: 'RTX 4090 ×4', region: 'kr', status: 'idle', listed: true, registeredAt: Date.now() - 45 * d },
  { id: 'M-06250011', gpu: 'GB300 ×1', region: 'sg', status: 'idle', listed: true, registeredAt: Date.now() - 30 * d },
  { id: 'M-04770132', gpu: 'RTX 5090 ×4', region: 'kr', status: 'idle', listed: false, registeredAt: Date.now() - 12 * d },
  { id: 'M-02933310', gpu: 'H200 NVL ×2', region: 'jp', status: 'idle', listed: false, registeredAt: Date.now() - 5 * d },
]

/* 机型 → 行情条目：先按显式表，再按名称匹配（新机型不必逐个登记） */
const MARKET_MODEL: Record<string, string> = { 'RTX 5090': 'rtx5090', 'RTX 4090': 'rtx4090', A100: 'a100', GB300: 'gb300' }

function marketEntry(model: string) {
  const id = MARKET_MODEL[model]
  if (id) return marketData.find(gpu => gpu.id === id)
  return marketData.find(gpu => gpu.name === model)
    ?? marketData.find(gpu => model.startsWith(gpu.name) || gpu.name.startsWith(model))
}

export type MachineView = HostMachine & {
  model: string
  count: number
  /* 整机挂牌时价（宿主调价可覆盖 seed） */
  dph: number
  /* 每卡挂牌时价＝对比市场的单位 */
  perCard: number
  /* 每卡显存（行情条目口径） */
  memory: string
  /* 同型号市场挂牌中位与区间（每卡 / 小时） */
  market: number
  range: [number, number] | null
  /* 每卡价相对中位的变化率，-0.56 表示低 56% */
  delta: number
  /* 未登记配置的机器不编造处理器/存储数字，界面整组不出 */
  specKnown: boolean
  vcpu: number
  memGb: number
  diskGb: number
  bwMbps: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

/* 一台机器的完整供给视图：规格（计费口径）+ 挂牌价（可覆盖）+ 市场位置 */
export function machineView(machine: HostMachine, price?: number): MachineView {
  const [model, countText] = machine.gpu.split(' ×')
  const count = Number(countText) || 1
  const spec = specOf(machine.id)
  const dph = price && price > 0 ? price : spec.dph
  const entry = marketEntry(model)
  /* 每卡价先取原始值比中位，再取整显示：避免「按中位定价」却显示高于中位 1% */
  const perCardRaw = dph / count
  const perCard = round2(perCardRaw)
  const market = entry ? entry.median : 0
  return {
    ...machine,
    model,
    count,
    dph: round2(dph),
    perCard,
    memory: entry ? entry.memory.replace(' / GPU', '') : '',
    market,
    range: entry ? entry.range : null,
    delta: market ? (perCardRaw - market) / market : 0,
    specKnown: Boolean(MACHINE_SPECS[machine.id]),
    vcpu: spec.vcpu,
    memGb: Math.round(spec.memMb / 1024),
    diskGb: spec.diskGb,
    bwMbps: spec.bwMbps,
  }
}
