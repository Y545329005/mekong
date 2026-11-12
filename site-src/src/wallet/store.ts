/* ============================================================================
   资金账本（资金页 / 收益页 / 租用确认页共用）
   · 一个 USD 余额：入金方式（银行卡 / USDT）只是支付手段，不是第二个钱包
   · 余额背后是支付单：每笔充值记原金额、已退、已提、已消费，余额＝各支付单可用之和
   · 消费按 FIFO 摊到支付单，才能算出「这笔充值还剩多少可退」
   · 租户退出：卡充值走原路退款；数币充值走链上提现（两条机制都从余额扣）
   · 宿主收益：先进待结算，窗口结束后转可结算；结算通道待通道开通（v1 占位）
   · 账本跟着账户走：存储 key 带邮箱，换账号登录看到另一套数据
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { RATE_BW_MBPS_H, specOf } from './specs'

/* 入金方式（不是余额桶）：card＝银行卡 / Apple Pay / Google Pay；crypto＝USDT */
export type Channel = 'card' | 'crypto'

/* 退出申请：refund＝原路退款（只对卡支付单）；withdraw＝链上提现（只对数币支付单） */
export type ExitMethod = 'refund' | 'withdraw'
/* 对外 4 态：待处理 / 处理中 / 已完成 / 失败（完成文案按 method 区分） */
export type ExitStatus = 'pending' | 'processing' | 'done' | 'failed'

/* 宿主结算（v3.10 · 规格 P0-2 出金六态）：
   pending 待审 → approved 平台放行（只冻结，不动钱）→ processing 发起出款（此时才扣减收益）
   → sent 已出款 → paid 到账 / failed 出款失败（钱退回收益池）；pending 亦可 rejected 驳回（不动钱）。
   终态 paid / failed / rejected 不可再推进，推进函数按当前态拒绝越级。 */
export type SettleStatus = 'pending' | 'approved' | 'processing' | 'sent' | 'paid' | 'failed' | 'rejected'
export type SettleRequest = {
  id: string
  amount: number
  status: SettleStatus
  at: number
}

export type Payment = {
  id: string
  channel: Channel
  /* 入账 USD 金额（加密收单按订单 USD 金额入账，不做二次换算） */
  amount: number
  /* 已退 / 已提 / 已消费，均为 USD；可用＝amount − 三者之和 */
  refunded: number
  withdrawn: number
  consumed: number
  at: number
  /* 数币充值的实付币数额（演示 1:1 收银台报价；真实以收银台报价为准） */
  paidCoin?: { symbol: string; amount: number }
  /* 可退截止日：卡组织窗口以内；演示用 30 天，真实按支付方式（常见 180 天） */
  refundUntil: number
}

export type ExitRequest = {
  id: string
  method: ExitMethod
  amount: number
  status: ExitStatus
  at: number
  /* 退款要指到具体支付单；提现按 FIFO 分摊（同样记下来用于对账） */
  allocations: Array<{ paymentId: string; amount: number }>
  /* 链上提现的目标地址 */
  address?: string
  /* 提现通道报价（提交时锁定，完成时按锁价落流水）：到账币数额与通道费 */
  quote?: { symbol: string; amount: number; fee: number }
  /* 失败时支付单额度是否已回滚，防重复回滚 */
  restored?: boolean
}

/* 流水：kind 决定说明文案；channel 只用于充值行标注入金方式；
   balAfter 是该笔之后的余额；gross/fee 仅宿主收益行使用。
   into=余额入账（实例退款/违约退回）：符号列按它显示 +，出金类 refund 仍显示 -。 */
export type LedgerKind = 'topup' | 'consume' | 'refund' | 'withdraw' | 'earning' | 'penalty'
export type LedgerRow = {
  id: string
  kind: LedgerKind
  amount: number
  at: number
  channel?: Channel
  label?: string
  balAfter?: number
  into?: boolean
  /* 数币侧数值（仅 crypto 通道的充值/提现行）：symbol 当前恒 USDT；
     fee 单列，让汇损/通道费可与 USD 金额对账 */
  coin?: { symbol: string; amount: number; fee?: number }
  gross?: number
  fee?: number
  /* 用量构成标注（仅 consume 行）：gpu=按量运行费（可拆带宽）、storage=停机存储费；
     缺省=种子/订单预付消费（凭证层按 GPU 运行费口径拆分）。只供资金页凭证展示，不参与账务。 */
  billType?: 'gpu' | 'storage'
  /* 该笔收益的待结算到期时刻：到点即为可结算 */
  holdUntil?: number
}

/* 实例状态机（订单即实例：一个订单行从开通到结案的全生命周期）。
   过渡态 Creating→Loading→Connecting→Running 由真实钟推进；
   Inactive=停机（仅存储费）；Expired=租约到期（保留展示，可销毁）。 */
export type InstanceStatus =
  | 'Reserved' | 'Creating' | 'Loading' | 'Connecting' | 'Running'
  | 'Rebooting' | 'Inactive' | 'Scheduling' | 'Offline' | 'Expired' | 'Destroyed'
/* 订单 SKU：order=时段订单（预付全款、摊销不出余额）；ondemand=按量（按小时从余额扣） */
export type ContractType = 'ondemand' | 'order'

export type OrderRow = {
  id: string
  machine: string
  amount: number
  /* 支付即开通：订单只有这一个状态；反悔＝控制台销毁实例 */
  hours?: number
  at: number
  /* —— 实例视图字段（下单/播种时生成，引擎推进）—— */
  contractType: ContractType
  gpu: string
  dph: number
  diskGb: number
  imageTag: string
  ip: string
  port22: number
  port8080: number
  customPorts: number[]
  launchMode: 'ssh' | 'jupyter'
  endUse?: string
  label?: string
  rentalEnd?: number
  phaseUntil?: number
  resolveAt?: number
  escrowHold: number
  amortized: number
  spentTotal: number
  acc: number
  offlineAt?: number
  debtStopped?: boolean
  stuck?: boolean
  stuckHint?: boolean
  /* 销毁时刻：历史记录卡显示「使用时段」（开通 → 销毁） */
  destroyedAt?: number
  status: InstanceStatus
}

export type HoldEntry = { id: string; amount: number; expireT: number }

export type WalletState = {
  seedVersion: number
  /* 用户看到的唯一余额（USD）；= Σ 支付单可用 + Σ 在途退出 */
  balance: number
  earnings: number
  held: number
  holdQueue: HoldEntry[]
  /* 宿主结算申请（六态推进，见 SettleStatus 注） */
  settleReqs: SettleRequest[]
  /* 租户流水（充值 / 租卡扣款 / 退款 / 提现） */
  ledger: LedgerRow[]
  /* 宿主流水（收益入账），与租户流水分账本 */
  earningLedger: LedgerRow[]
  payments: Payment[]
  exits: ExitRequest[]
  orders: OrderRow[]
  /* 上次实例引擎推进时刻：离开实例页期间不追溯计费，回来最多补 1 分钟 */
  tickAt?: number
  /* 账号注册时刻：演示口径由种子造数；真实业务来自 auth 系统 */
  createdAt?: number
}

export const DEMO_EMAIL = 'demo@demo.dev'
/* 最低充值额：卡 $16（平台策略值）；USDT 10（严于 Infini 官方 >0.1） */
export const MIN_TOPUP: Record<Channel, number> = { card: 16, crypto: 10 }
/* 提现门槛：链上提现按 USDT 计，低于此值手续费占比不划算 */
export const MIN_WITHDRAW = 10
/* 退款门槛（避免分币级请求） */
export const MIN_REFUND = 1
/* 演示用通道时效字段（卡组织原路退回有时限，常见 180 天）：只做记录，
   不当作拦截条件——用户的预付款不因时间流逝而失去可退性。 */
export const REFUND_WINDOW_DAYS = 30
/* 退款冷静期与次数上限：防「充值→退款」反复烧收单费 */
export const REFUND_COOLING_DAYS = 7
export const CHANNEL_LABEL = {
  zh: { card: '银行卡', crypto: 'USDT' },
  en: { card: 'Card', crypto: 'USDT' },
} as const

export const now = () => Date.now()
/** USD 金额 */
export const money = (v: number) => `$${(+v || 0).toFixed(2)}`
/** USDT 金额（链上提现报价用） */
export const usdt = (v: number) => `${(+v || 0).toFixed(2)} USDT`
export const stamp = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  /* 30 天窗口可跨年：非当年流水补年份，避免「12-28」被误读成本年 */
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}-${md}`
}
/** 完整时间戳（始终带年份）：历史记录的起止时刻，容不下「哪一年」的歧义 */
export const stampFull = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const round2 = (v: number) => +v.toFixed(2)
const uid = (p: string) => `${p}-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
/** 供调用方先生成订单号再落账（确认页支付用） */
export const newId = uid

/* 提现通道报价（演示口径）：费 1%、最低 0.50 USDT，到账 = 申请额 − 费。
   真实业务按通道实时报价，故提交时锁定（ExitRequest.quote），完成时按锁价落流水。 */
export const WITHDRAW_FEE_RATE = 0.01
export const WITHDRAW_FEE_MIN = 0.5
export function withdrawQuote(usd: number) {
  const fee = round2(Math.max(WITHDRAW_FEE_MIN, usd * WITHDRAW_FEE_RATE))
  return { symbol: 'USDT', amount: round2(Math.max(0, usd - fee)), fee }
}

/** 退出单号：客诉按单号查证 */
export const exitNo = (req: ExitRequest) => {
  const d = new Date(req.at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const tail = req.id.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(-4).padStart(4, '0')
  return `${req.method === 'refund' ? 'RF' : 'WD'}-${day}-${tail}`
}

const walletKey = (email: string) => `mk-site-wallet:${email}`

/* seed 版本：后台 IA/结算种子调整时 +1 → 旧存档整体重播种。
   注意：重播种会清掉本机演示期间的充值/下单记录（演示账号口径，可接受）。 */
export const SEED_VERSION = 13

/* 实例状态的展示口径（两页共用：实例卡 pill + 资金页订单表） */
export const STATUS_TONES: Record<InstanceStatus, 'ok' | 'info' | 'warn' | 'bad' | 'muted'> = {
  Reserved: 'info', Creating: 'info', Loading: 'info', Connecting: 'info',
  Running: 'ok', Rebooting: 'info', Inactive: 'muted', Scheduling: 'warn',
  Offline: 'bad', Expired: 'bad', Destroyed: 'muted',
}
export const statusLabel = (lang: 'zh' | 'en', status: InstanceStatus) => {
  const zh: Record<InstanceStatus, string> = {
    Reserved: '已预定 · 待开机', Creating: '创建中', Loading: '拉取镜像', Connecting: '连接中',
    Running: '运行中', Rebooting: '重启中', Inactive: '已停止', Scheduling: '排队中',
    Offline: '宿主断连', Expired: '租约到期', Destroyed: '已销毁',
  }
  const en: Record<InstanceStatus, string> = {
    Reserved: 'Reserved', Creating: 'Creating', Loading: 'Loading', Connecting: 'Connecting',
    Running: 'Running', Rebooting: 'Rebooting', Inactive: 'Inactive', Scheduling: 'Scheduling',
    Offline: 'Offline', Expired: 'Expired', Destroyed: 'Destroyed',
  }
  return lang === 'zh' ? zh[status] : en[status]
}

/* ------------------------------------------------------------------ 支付单口径 */

/** 支付单可用余额（未退 / 未提 / 未消费） */
export const lotAvailable = (p: Payment) =>
  Math.max(0, round2(p.amount - p.refunded - p.withdrawn - p.consumed))

/** 该支付单可退：卡支付单，且已过 7 天冷静期（防「充值→退款」套现/洗单）。
    不设截止时间——预付款的可退性不随时间失效。 */
export const isRefundOpen = (p: Payment, at = now()) =>
  p.channel === 'card' && p.at + REFUND_COOLING_DAYS * 86400000 <= at

/** 本月已提交的退款笔数（含在途） */
export const refundsThisMonth = (s: WalletState) => {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return s.exits.filter(r => r.method === 'refund' && r.at >= start).length
}

/** 可退总额：卡支付单里仍在窗口内的可用额度 */
export const refundable = (s: WalletState) =>
  round2(s.payments.filter(p => isRefundOpen(p)).reduce((sum, p) => sum + lotAvailable(p), 0))

/** 可提（链上）总额：数币支付单的可用额度 */
export const cryptoWithdrawable = (s: WalletState) =>
  round2(s.payments.filter(p => p.channel === 'crypto').reduce((sum, p) => sum + lotAvailable(p), 0))

/** 在途退出总额（已占用支付单额度、还没落账） */
export const inFlightTotal = (s: WalletState) =>
  round2(s.exits.filter(r => r.status === 'pending' || r.status === 'processing').reduce((sum, r) => sum + r.amount, 0))

/** 可消费余额 = 余额 − 在途退出 */
export const spendable = (s: WalletState) => Math.max(0, round2(s.balance - inFlightTotal(s)))

/** 可结算 = 收益 − 待结算 − 放行冻结（approved 单占用；processing 后钱已出池不再占用） */
export const IN_SETTLE_STATUSES = ['approved'] as const
export const settleable = (s: WalletState) =>
  Math.max(0, round2(s.earnings - s.held - s.settleReqs.filter(r => (IN_SETTLE_STATUSES as readonly string[]).includes(r.status)).reduce((sum, r) => sum + r.amount, 0)))

/** 是否有在审结算单（同账号同时仅一笔在途：pending/approved/processing/sent） */
export const settleInFlight = (s: WalletState) =>
  s.settleReqs.some(r => ['pending', 'approved', 'processing', 'sent'].includes(r.status))

/** 结算单号：对账凭证（SR-YYMMDD-尾号） */
export const settleNo = (req: SettleRequest) => {
  const d = new Date(req.at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const tail = req.id.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(-4).padStart(4, '0')
  return `SR-${day}-${tail}`
}

/* ------------------------------------------------------------------ 种子 */

type SeedEvent = { ago: number; kind: 'topup' | 'consume'; channel: Channel; amount: number; machine?: string; billType?: 'gpu' | 'storage' }

function emptyState(): WalletState {
  return {
    seedVersion: SEED_VERSION,
    balance: 0,

    earnings: 0,
    held: 0,
    holdQueue: [],
    settleReqs: [],
    ledger: [],
    earningLedger: [],
    payments: [],
    exits: [],
    orders: [],
  }
}

/* 演示账本：按时间从旧到新声明事件，余额与支付单由链路推导，保证
   「余额 = 末笔流水后余额」「每笔订单都有对应的消费流水」。
   实例种子消费（末段）与下方种子实例的预付/累计花费一一对账。 */
function seedDemoWallet(): WalletState {
  const h = 3600000
  const d = 86400000
  const m = 60000
  const createdAt = now() - 40 * d
  const events: SeedEvent[] = [
    { ago: 40 * d, kind: 'topup', channel: 'card', amount: 300 },
    { ago: 38 * d + 2 * h, kind: 'consume', channel: 'card', amount: 32, machine: 'M-08820041 · B200 ×1' },
    { ago: 35 * d, kind: 'consume', channel: 'card', amount: 24, machine: 'M-04123077 · H100 ×2' },
    { ago: 30 * d, kind: 'topup', channel: 'crypto', amount: 100 },
    { ago: 28 * d + 4 * h, kind: 'consume', channel: 'crypto', amount: 20, machine: 'M-01114008 · A100 ×4' },
    { ago: 27 * d, kind: 'consume', channel: 'card', amount: 18, machine: 'M-01114008 · A100 ×4' },
    { ago: 21 * d, kind: 'topup', channel: 'card', amount: 100 },
    { ago: 19 * d + 3 * h, kind: 'consume', channel: 'card', amount: 12, machine: 'M-01822301 · L40S ×1' },
    { ago: 16 * d, kind: 'consume', channel: 'card', amount: 36, machine: 'M-06250011 · GB300 ×1' },
    { ago: 15 * d, kind: 'consume', channel: 'crypto', amount: 40, machine: 'M-03011042 · H200 NVL ×4' },
    { ago: 12 * d + h, kind: 'consume', channel: 'card', amount: 9.6, machine: 'M-05111209 · H200 NVL ×1' },
    { ago: 10 * d, kind: 'consume', channel: 'card', amount: 20, machine: 'M-04123077 · H100 ×2' },
    { ago: 9 * d + 2 * h, kind: 'consume', channel: 'card', amount: 16, machine: 'M-07730119 · RTX 4090 ×4' },
    { ago: 8 * d, kind: 'topup', channel: 'crypto', amount: 40 },
    { ago: 7 * d, kind: 'topup', channel: 'card', amount: 60 },
    { ago: 6 * d + h, kind: 'consume', channel: 'card', amount: 12, machine: 'M-01822301 · L40S ×1' },
    { ago: 80 * h, kind: 'consume', channel: 'card', amount: 51.84, machine: 'M-07730119 · RTX 4090 ×4' },
    { ago: 5 * d, kind: 'consume', channel: 'card', amount: 20, machine: 'M-01114008 · A100 ×4' },
    { ago: 3 * d + h, kind: 'consume', channel: 'crypto', amount: 20, machine: 'M-01114008 · A100 ×4' },
    { ago: 2 * d + 2 * h, kind: 'topup', channel: 'card', amount: 100 },
    { ago: 1 * d + 4 * h, kind: 'consume', channel: 'card', amount: 12, machine: 'M-05904012 · RTX 5090 ×2' },
    { ago: 8 * h, kind: 'consume', channel: 'card', amount: 14.8, machine: 'M-01822301 · L40S ×1' },
    { ago: 5 * h, kind: 'consume', channel: 'card', amount: 5.2, machine: 'M-03011042 · H200 NVL ×1', billType: 'storage' },
    { ago: 2 * h, kind: 'consume', channel: 'card', amount: 12, machine: 'M-05904012 · RTX 5090 ×2' },
    { ago: 2 * h, kind: 'consume', channel: 'card', amount: 19.92, machine: 'M-08820041 · B200 ×1' },
    { ago: 20 * m, kind: 'consume', channel: 'card', amount: 1.37, machine: 'M-06250011 · GB300 ×1' },
    { ago: 10 * m, kind: 'consume', channel: 'card', amount: 88.8, machine: 'M-01114008 · A100 ×4' },
  ]

  let state = emptyState()
  events.forEach((event, index) => {
    const at = now() - event.ago
    if (event.kind === 'topup') {
      state = applyTopupAt(state, event.channel, event.amount, at, `p-seed-${index + 1}`)
    } else if (event.machine) {
      state = applySeedConsume(state, event.machine, event.amount, at, event.billType)
    }
  })

  /* 种子实例：与真实流程同形——对外站只开放按需租用（预定/弹性为禁用项），
     故全部 ondemand：无预付、可停止、按秒计费。状态覆盖：运行/排队/加载/
     已停止/欠费停机/宿主断连/已销毁（历史记录保留）。 */
  const t = now()
  const inst = seedInst
  const seedInstances: OrderRow[] = [
    inst({ id: 'o-seed-b200', machine: 'M-08820041 · B200 ×1', gpu: 'B200 ×1', amount: 0, contractType: 'ondemand',
      dph: 2.49, status: 'Running', at: t - 2 * h, spentTotal: 5.7, endUse: 'training',
      diskGb: 360, imageTag: 'pytorch:2.5-cuda12.4', ip: '45.77.132.51', port22: 51820, port8080: 50810, customPorts: [31245] }),
    inst({ id: 'o-seed-l40s', machine: 'M-01822301 · L40S ×1', gpu: 'L40S ×1', amount: 0, contractType: 'ondemand',
      dph: 1.85, status: 'Running', at: t - 8 * h, spentTotal: 17.13, endUse: 'research',
      imageTag: 'pytorch:2.4-cuda12.4', ip: '45.77.132.52', port22: 51821, port8080: 50811 }),
    inst({ id: 'o-seed-5090', machine: 'M-05904012 · RTX 5090 ×2', gpu: 'RTX 5090 ×2', amount: 0, contractType: 'ondemand',
      dph: 2.16, status: 'Running', at: t - 2 * m, spentTotal: 3.04, endUse: 'inference',
      imageTag: 'nvidia:cuda-12.4-runtime', ip: '45.77.132.53', port22: 51822, port8080: 50812 }),
    inst({ id: 'o-seed-h200l', machine: 'M-05111209 · H200 NVL ×1', gpu: 'H200 NVL ×1', amount: 0, contractType: 'ondemand',
      dph: 2.2, status: 'Loading', at: t - 12_000, phaseUntil: t + 10_000, launchMode: 'jupyter', spentTotal: 3.09, endUse: 'training',
      imageTag: 'pytorch:2.5-cuda12.6', ip: '45.77.132.54', port22: 51823, port8080: 50813 }),
    inst({ id: 'o-seed-a100', machine: 'M-01114008 · A100 ×4', gpu: 'A100 ×4', amount: 0, contractType: 'ondemand',
      dph: 3.7, status: 'Inactive', at: t - 26 * h, spentTotal: 88.8, endUse: 'training',
      imageTag: 'tensorflow:2.17-cuda12.3', ip: '45.77.132.55', port22: 51824, port8080: 50814 }),
    inst({ id: 'o-seed-h200s', machine: 'M-03011042 · H200 NVL ×1', gpu: 'H200 NVL ×1', amount: 0, contractType: 'ondemand',
      dph: 2.2, status: 'Inactive', at: t - 5 * h, spentTotal: 5.2, endUse: 'research',
      imageTag: 'pytorch:2.4-cuda12.4', ip: '45.77.132.56', port22: 51825, port8080: 50815 }),
    inst({ id: 'o-seed-gb300', machine: 'M-06250011 · GB300 ×1', gpu: 'GB300 ×1', amount: 0, contractType: 'ondemand',
      dph: 4.11, status: 'Offline', at: t - 20 * m, offlineAt: t - 2 * m, spentTotal: 1.37, endUse: 'inference',
      imageTag: 'nvidia:nim-llm:latest', ip: '45.77.132.58', port22: 51827, port8080: 50817 }),
    inst({ id: 'o-seed-4090', machine: 'M-07730119 · RTX 4090 ×4', gpu: 'RTX 4090 ×4', amount: 0, contractType: 'ondemand',
      dph: 0.72, status: 'Destroyed', at: t - 80 * h, destroyedAt: t - 8 * h, spentTotal: 51.84, endUse: 'other',
      imageTag: 'pytorch:2.3-cuda12.1', ip: '45.77.132.57', port22: 51826, port8080: 50816 }),
  ]
  state = { ...state, orders: [...seedInstances, ...state.orders] }

  /* 宿主收益：净额先进待结算（演示窗口 20 秒，早已解锁）。
     结算历史与 earnings 自洽：入账 net 240 − paid 60 − paid 40（发起出款时已扣）= 140；
     paid 单为终态、pending 单不动钱（审批依据侧的收益池即 140）。 */
  const earningAt = now() - 3 * d
  state = {
    ...state,
    earnings: 140,
    held: 0,
    holdQueue: [],
    /* 头部最新：2 天前在前、3 天前在后 */
    earningLedger: [
      { id: 'l-seed-e2', kind: 'earning', amount: 60, gross: 64, fee: 4, at: now() - 2 * d, balAfter: 240, holdUntil: now() - 2 * d + 20000 },
      { id: 'l-seed-e1', kind: 'earning', amount: 180, gross: 200, fee: 20, at: earningAt, balAfter: 240, holdUntil: earningAt + 20000 },
    ],
    /* 同账号同时仅一笔在途：sr-seed-3 pending，其余均已终态 */
    settleReqs: [
      { id: 'sr-seed-3', amount: 50, status: 'pending', at: now() - 6 * h },
      { id: 'sr-seed-2', amount: 40, status: 'paid', at: now() - 2 * d },
      { id: 'sr-seed-1', amount: 60, status: 'paid', at: earningAt + 60000 },
    ],
  }

  /* 退出历史：一笔原路退款、一笔链上提现（都已完成），让记录表不为空 */
  const refundLot = state.payments
    .filter(p => p.channel === 'card' && lotAvailable(p) >= 20)
    .sort((a, b) => a.at - b.at)[0]
  if (refundLot) {
    const at = now() - 5 * m
    const submitted = applyExitSubmitAt(state, 'refund', 20, { paymentId: refundLot.id, at })
    if (submitted) state = applyExitAdvanceAt(submitted, submitted.exits[0].id, 'done', at + 30000)
  }
  if (cryptoWithdrawable(state) >= 20) {
    const at = now() - 3 * m
    const submitted = applyExitSubmitAt(state, 'withdraw', 20, { address: 'TQ5xDemoWalletAddress0000000000', at })
    if (submitted) state = applyExitAdvanceAt(submitted, submitted.exits[0].id, 'done', at + 30000)
  }

  return { ...state, createdAt }
}

/* 种子订单工厂：与真实下单流程同形（对外站只开放按需租用，全部 ondemand）。
   demo 桶与演示账号桶共用，各桶自选机器/状态/用途。 */
const seedInst = (p: Partial<OrderRow> & Pick<OrderRow, 'id' | 'machine' | 'gpu' | 'amount' | 'contractType' | 'dph' | 'status' | 'at'>): OrderRow => ({
  diskGb: 240, imageTag: 'pytorch:2.4-cuda12.4', ip: '45.77.132.51', port22: 51820, port8080: 50810,
  customPorts: [], launchMode: 'ssh', escrowHold: 0, amortized: 0, spentTotal: 0, acc: 0, ...p,
})

/* —— 演示账号桶（后台「用户管理」的种子主体）：事件走与 demo 桶同一摊账管道
   （applyTopupAt / applySeedConsume），租客守恒由摊账引擎保证闭合；host 桶无租客
   支付、只有宿主收益（Σgross = Σnet + Σfee 逐行固化），对账页仅出现宿主侧。
   首次派生时播种落盘，之后随存档走。函数形态：at/holdUntil 取播种时刻，
   不随模块加载固化。 —— */
type SeedAccountSpec = { createdAt: number; events: SeedEvent[]; orders: OrderRow[]; host?: Pick<WalletState, 'earnings' | 'held' | 'holdQueue' | 'earningLedger' | 'settleReqs'> }
const SD = { h: 3600000, d: 86400000, m: 60000 }

function seedAccountSpec(email: string): SeedAccountSpec | undefined {
  const t = now()
  if (email === 'wei@demo.dev') return {
    createdAt: t - 10 * SD.d,
    events: [
      { ago: 10 * SD.d, kind: 'topup', channel: 'card', amount: 80 },
      { ago: 6 * SD.d, kind: 'consume', channel: 'card', amount: 18.4, machine: 'M-01822301 · L40S ×1' },
      { ago: 2 * SD.d, kind: 'consume', channel: 'card', amount: 9.6, machine: 'M-05111209 · H200 NVL ×1' },
    ],
    orders: [
      seedInst({ id: 'o-wei-l40s', machine: 'M-01822301 · L40S ×1', gpu: 'L40S ×1', amount: 0, contractType: 'ondemand',
        dph: 1.85, status: 'Inactive', at: t - 6 * SD.d, spentTotal: 18.4, endUse: 'research',
        ip: '45.77.132.61', port22: 51831, port8080: 50821 }),
    ],
  }
  if (email === 'corp@demo.dev') return {
    createdAt: t - 15 * SD.d,
    events: [
      { ago: 15 * SD.d, kind: 'topup', channel: 'crypto', amount: 400 },
      { ago: 12 * SD.d, kind: 'consume', channel: 'crypto', amount: 48, machine: 'M-01114008 · A100 ×4' },
      { ago: 9 * SD.d, kind: 'consume', channel: 'crypto', amount: 36, machine: 'M-08820041 · B200 ×1' },
      { ago: 4 * SD.d, kind: 'topup', channel: 'card', amount: 200 },
      { ago: 5 * SD.h, kind: 'consume', channel: 'card', amount: 22.4, machine: 'M-06250011 · GB300 ×1' },
      { ago: 3 * SD.h, kind: 'consume', channel: 'card', amount: 36.8, machine: 'M-08820041 · B200 ×1' },
      { ago: 30 * SD.m, kind: 'consume', channel: 'card', amount: 90, machine: 'M-01114008 · A100 ×4' },
      { ago: 12 * SD.m, kind: 'consume', channel: 'card', amount: 76.8, machine: 'M-05111209 · H200 NVL ×1' },
    ],
    orders: [
      seedInst({ id: 'o-corp-h200', machine: 'M-05111209 · H200 NVL ×1', gpu: 'H200 NVL ×1', amount: 0, contractType: 'ondemand',
        dph: 2.2, status: 'Running', at: t - 20 * SD.h, spentTotal: 76.8, endUse: 'training',
        imageTag: 'pytorch:2.5-cuda12.6', ip: '45.77.132.62', port22: 51832, port8080: 50822 }),
      seedInst({ id: 'o-corp-gb300', machine: 'M-06250011 · GB300 ×1', gpu: 'GB300 ×1', amount: 0, contractType: 'ondemand',
        dph: 4.11, status: 'Offline', at: t - 9 * SD.h, offlineAt: t - 40 * SD.m, spentTotal: 22.4, endUse: 'inference',
        imageTag: 'nvidia:nim-llm:latest', ip: '45.77.132.63', port22: 51833, port8080: 50823 }),
    ],
  }
  if (email === 'host@demo.dev') return {
    createdAt: t - 45 * SD.d,
    events: [], orders: [],
    /* 结算自洽：Σnet 135 − paid 45 = earnings 90；pending 单不动钱 */
    host: {
      earnings: 90, held: 0, holdQueue: [],
      earningLedger: [
        { id: 'l-host-e2', kind: 'earning', amount: 45, gross: 50, fee: 5, at: t - 1 * SD.d, balAfter: 135, holdUntil: t - 1 * SD.d + 20000 },
        { id: 'l-host-e1', kind: 'earning', amount: 90, gross: 100, fee: 10, at: t - 3 * SD.d, balAfter: 90, holdUntil: t - 3 * SD.d + 20000 },
      ],
      settleReqs: [
        { id: 'sr-host-3', amount: 30, status: 'pending', at: t - 6 * SD.h },
        { id: 'sr-host-2', amount: 45, status: 'paid', at: t - 1 * SD.d },
      ],
    },
  }
  return undefined
}

function seedAccountWallet(email: string, spec: SeedAccountSpec): WalletState {
  let state = emptyState()
  spec.events.forEach((event, index) => {
    const at = now() - event.ago
    if (event.kind === 'topup') state = applyTopupAt(state, event.channel, event.amount, at, `p-${email.split('@')[0]}-${index + 1}`)
    else if (event.machine) state = applySeedConsume(state, event.machine, event.amount, at, event.billType)
  })
  return { ...state, orders: spec.orders, createdAt: spec.createdAt, ...(spec.host ?? {}) }
}

function seedWallet(email: string): WalletState {
  if (email === DEMO_EMAIL) return seedDemoWallet()
  const spec = seedAccountSpec(email)
  return spec ? seedAccountWallet(email, spec) : emptyState()
}

export function loadWallet(email: string): WalletState {
  const base = seedWallet(email)
  try {
    const raw = localStorage.getItem(walletKey(email))
    if (!raw) { saveWallet(email, base); return base }
    const saved = JSON.parse(raw) as Partial<WalletState>
    /* 旧版 seed 的存档直接丢弃重播种：单 USD 模型与双币存档无法无损映射。
       重播种结果立刻落盘——否则只读的消费方（运营后台）每次加载都拿到新 uid，
       流水单号/订单 id 跨刷新漂移，「按单号对账」就不成立 */
    if (saved.seedVersion !== SEED_VERSION) { saveWallet(email, base); return base }
    return {
      seedVersion: SEED_VERSION,
      balance: Number(saved.balance) || 0,
      earnings: Number(saved.earnings) || 0,
      held: Number(saved.held) || 0,
      holdQueue: Array.isArray(saved.holdQueue) ? saved.holdQueue : base.holdQueue,
      settleReqs: Array.isArray(saved.settleReqs) ? saved.settleReqs : base.settleReqs,
      ledger: Array.isArray(saved.ledger) ? saved.ledger : base.ledger,
      earningLedger: Array.isArray(saved.earningLedger) ? saved.earningLedger : base.earningLedger,
      payments: Array.isArray(saved.payments) ? saved.payments : base.payments,
      exits: Array.isArray(saved.exits) ? saved.exits : base.exits,
      orders: (Array.isArray(saved.orders) ? saved.orders : base.orders).filter(o => o && o.id && o.status),
      tickAt: Number(saved.tickAt) || undefined,
      createdAt: Number(saved.createdAt) || undefined,
    }
  } catch {
    return base
  }
}

export function saveWallet(email: string, state: WalletState) {
  try { localStorage.setItem(walletKey(email), JSON.stringify(state)) } catch { /* 隐私模式下不落盘 */ }
}

/** 账户隔离的账本状态：挂载时读一次，变更即落盘。email 为空时只给零态、不持久化。 */
export function useWallet(email: string) {
  const seed = useRef<WalletState | null>(null)
  if (!seed.current) seed.current = loadWallet(email)
  const [wallet, setWallet] = useState(seed.current)
  useEffect(() => { if (email) saveWallet(email, wallet) }, [email, wallet])
  return { wallet, setWallet }
}

/* ------------------------------------------------------------------ 纯操作 */

function withLedger(s: WalletState, row: LedgerRow): WalletState {
  return { ...s, ledger: [row, ...s.ledger].slice(0, 60) }
}

/* 宿主账本独立 cap：与租户流水互不挤占，30 天汇总口径不被租户活动影响 */
const EARNING_LEDGER_CAP = 200

function withEarningLedger(s: WalletState, row: LedgerRow): WalletState {
  return { ...s, earningLedger: [row, ...s.earningLedger].slice(0, EARNING_LEDGER_CAP) }
}

/** 充值入余额（演示态：托管收单 / 链上确认成功后调用），同时生成支付单 */
export function applyTopup(s: WalletState, channel: Channel, amount: number): WalletState {
  return applyTopupAt(s, channel, amount, now())
}

function applyTopupAt(s: WalletState, channel: Channel, amount: number, at: number, id = uid('p')): WalletState {
  const balance = round2(s.balance + amount)
  /* 数币充值的实付币数额：演示按收银台 1:1 报价；真实接入后取收银台报价值 */
  const paidCoin = channel === 'crypto' ? { symbol: 'USDT', amount } : undefined
  const payment: Payment = {
    id,
    channel,
    amount,
    paidCoin,
    refunded: 0,
    withdrawn: 0,
    consumed: 0,
    at,
    refundUntil: at + REFUND_WINDOW_DAYS * 86400000,
  }
  return withLedger(
    { ...s, balance, payments: [payment, ...s.payments] },
    { id: uid('l'), kind: 'topup', amount, at, channel, coin: paidCoin, balAfter: balance },
  )
}

/** 种子历史消费：只落账本（FIFO 摊到支付单 + 流水），不生成订单行——
    资金页「最近订单」与实例页同源（在役订单），历史消费走流水呈现。 */
function applySeedConsume(s: WalletState, machine: string, amount: number, at: number, billType?: LedgerRow['billType']): WalletState {
  const balance = round2(s.balance - amount)
  let left = amount
  const lots = [...s.payments].sort((a, b) => a.at - b.at)
  const payments = s.payments.map(p => ({ ...p }))
  for (const lot of lots) {
    if (left <= 1e-9) break
    const target = payments.find(p => p.id === lot.id)!
    const take = Math.min(left, lotAvailable(target))
    if (take > 0) {
      target.consumed = round2(target.consumed + take)
      left = round2(left - take)
    }
  }
  return withLedger(
    { ...s, balance, payments },
    { id: uid('l'), kind: 'consume', amount, at, label: machine, balAfter: balance, billType },
  )
}

/* 实例下单参数：RentalPage 确认页支付时传入（订单 SKU 预付开通，起步 Creating） */
export type NewInstance = {
  machine: string
  gpu: string
  dph: number
  hours?: number
  contractType: ContractType
  diskGb?: number
  imageTag?: string
  launchMode?: 'ssh' | 'jupyter'
  /* end-use 声明：订单级留痕（training/inference/research/other） */
  endUse?: string
  ip?: string
  port22?: number
  port8080?: number
}

/* 连接信息演示分配：公网 ip + 高位端口（种子外的真实下单走这里） */
const randPort = () => 40000 + Math.floor(Math.random() * 20000)
const randIp = () => `45.77.${100 + Math.floor(Math.random() * 120)}.${10 + Math.floor(Math.random() * 240)}`

/** 余额扣款并开通实例（订单行＝实例本体，起步 Creating；预付订单 escrowHold=全额，摊销不动余额） */
export function applyPayOrder(s: WalletState, machine: NewInstance, amount: number, orderId = uid('o'), at = now()): { state: WalletState; order: OrderRow } {
  const order = newInstanceRow(machine, amount, orderId, at)
  return { state: applyPayOrderAt(s, order, amount, at), order }
}

function newInstanceRow(m: NewInstance, amount: number, id: string, at: number): OrderRow {
  const diskGb = m.diskGb ?? 240
  return {
    id,
    machine: m.machine,
    amount,
    hours: m.hours,
    at,
    contractType: m.contractType,
    gpu: m.gpu,
    dph: m.dph,
    diskGb,
    imageTag: m.imageTag ?? 'pytorch:2.4-cuda12.4',
    ip: m.ip ?? randIp(),
    port22: m.port22 ?? randPort(),
    port8080: m.port8080 ?? randPort(),
    customPorts: [],
    launchMode: m.launchMode ?? 'ssh',
    endUse: m.endUse,
    status: 'Creating',
    phaseUntil: at + 15000,
    rentalEnd: m.hours ? at + m.hours * 3600000 : undefined,
    escrowHold: m.contractType === 'order' ? amount : 0,
    amortized: 0,
    spentTotal: 0,
    acc: 0,
  }
}

function applyPayOrderAt(s: WalletState, order: OrderRow, amount: number, at: number): WalletState {
  const balance = round2(s.balance - amount)
  let left = amount
  /* FIFO：先入先出，保证每笔退款能追溯到具体支付单 */
  const lots = [...s.payments].sort((a, b) => a.at - b.at)
  const payments = s.payments.map(p => ({ ...p }))
  for (const lot of lots) {
    if (left <= 1e-9) break
    const target = payments.find(p => p.id === lot.id)!
    const take = Math.min(left, lotAvailable(target))
    if (take > 0) {
      target.consumed = round2(target.consumed + take)
      left = round2(left - take)
    }
  }
  const next = { ...s, balance, payments, orders: [order, ...s.orders] }
  /* 按量开通不预付：0 金额不落流水（余额未变，记一笔 $0 只会污染对账） */
  if (amount < 0.005) return next
  return withLedger(next, { id: uid('l'), kind: 'consume', amount, at, label: order.machine, balAfter: balance })
}

/** 宿主收益入账：净额先进待结算，到期转可结算 */
export function applyAccrue(s: WalletState, gross: number, fee: number): WalletState {
  const net = round2(gross - fee)
  const at = now()
  /* 演示窗口 20 秒；真实窗口按 SKU 定（批 2） */
  const unlockAt = at + 20000
  const earnings = round2(s.earnings + net)
  return withEarningLedger(
    {
      ...s,
      earnings,
      held: round2(s.held + net),
      holdQueue: [...s.holdQueue, { id: uid('h'), amount: net, expireT: unlockAt }],
    },
    { id: uid('l'), kind: 'earning', amount: net, gross, fee, at, balAfter: earnings, holdUntil: unlockAt },
  )
}

/** 待结算窗口到期批量解锁，返回解锁总额（无到期返回 null） */
export function applyHoldUnlock(s: WalletState): { state: WalletState; unlocked: number } | null {
  const due = s.holdQueue.filter(entry => entry.expireT <= now())
  if (!due.length) return null
  const unlocked = round2(due.reduce((sum, e) => sum + e.amount, 0))
  return {
    state: { ...s, held: Math.max(0, round2(s.held - unlocked)), holdQueue: s.holdQueue.filter(entry => entry.expireT > now()) },
    unlocked,
  }
}

/** 提交退出申请：占用支付单额度（余额不动，待完成时才扣）；额度不足返回 null */
export function applyExitSubmit(s: WalletState, method: ExitMethod, amount: number, opts: { paymentId?: string; address?: string } = {}): WalletState | null {
  return applyExitSubmitAt(s, method, amount, opts)
}

function applyExitSubmitAt(s: WalletState, method: ExitMethod, amount: number, opts: { paymentId?: string; address?: string; at?: number }): WalletState | null {
  if (!(amount > 0)) return null
  /* 退款冷静期与月度次数：在账本层兜底，不依赖 UI */
  const at = opts.at ?? now()
  const field = method === 'refund' ? 'refunded' : 'withdrawn'
  const lots = s.payments
    .filter(p => method === 'refund' ? isRefundOpen(p) : p.channel === 'crypto')
    .filter(p => (opts.paymentId ? p.id === opts.paymentId : true))
    .sort((a, b) => a.at - b.at)
  const total = round2(lots.reduce((sum, p) => sum + lotAvailable(p), 0))
  if (total + 1e-9 < amount) return null

  const payments = s.payments.map(p => ({ ...p }))
  const allocations: Array<{ paymentId: string; amount: number }> = []
  let left = amount
  for (const lot of lots) {
    if (left <= 1e-9) break
    const target = payments.find(p => p.id === lot.id)!
    const take = Math.min(left, lotAvailable(target))
    if (take > 0) {
      target[field] = round2(target[field] + take)
      allocations.push({ paymentId: target.id, amount: take })
      left = round2(left - take)
    }
  }
  const request: ExitRequest = {
    id: uid(method === 'refund' ? 'r' : 'w'),
    method,
    amount,
    status: 'pending',
    at,
    allocations,
    address: opts.address,
    /* 提现报价提交时锁定：真实通道报价会变，完成时按锁价落账 */
    quote: method === 'withdraw' ? withdrawQuote(amount) : undefined,
  }
  return { ...s, payments, exits: [request, ...s.exits] }
}

/** 演示推进：待处理 → 处理中 → 完成 / 失败。失败回滚支付单额度，完成才扣余额 */
export function applyExitAdvance(s: WalletState, id: string, to: ExitStatus): WalletState {
  return applyExitAdvanceAt(s, id, to, now())
}

function applyExitAdvanceAt(s: WalletState, id: string, to: ExitStatus, at: number): WalletState {
  const req = s.exits.find(r => r.id === id)
  /* 终态不可再变：否则会重复扣款或重复回滚额度 */
  if (!req || req.status === to || req.status === 'done' || req.status === 'failed') return s

  let next = s
  if (to === 'done') {
    const balance = round2(s.balance - req.amount)
    next = withLedger(
      { ...s, balance, exits: s.exits.map(r => r.id === id ? { ...r, status: to } : r) },
      { id: uid('l'), kind: req.method === 'refund' ? 'refund' : 'withdraw', amount: req.amount, at, coin: req.quote, balAfter: balance },
    )
  } else if (to === 'failed') {
    /* 回滚占用的支付单额度；只回滚一次 */
    const payments = req.restored ? s.payments : s.payments.map(p => {
      const used = req.allocations.filter(a => a.paymentId === p.id).reduce((sum, a) => sum + a.amount, 0)
      if (!used) return p
      return req.method === 'refund'
        ? { ...p, refunded: Math.max(0, round2(p.refunded - used)) }
        : { ...p, withdrawn: Math.max(0, round2(p.withdrawn - used)) }
    })
    next = {
      ...s,
      payments,
      exits: s.exits.map(r => r.id === id ? { ...r, status: to, restored: true } : r),
    }
  } else {
    next = { ...s, exits: s.exits.map(r => r.id === id ? { ...r, status: to } : r) }
  }
  return next
}

/* —— 宿主结算（规格 P0-2 出金六态）—— */

/** 提交结算申请：申请全部可结算额；同账号同时仅一笔在途，超额/有在途返回 null */
export function applySettleSubmit(s: WalletState, amount: number, at = now()): WalletState | null {
  if (!(amount > 0) || settleInFlight(s)) return null
  if (amount > settleable(s) + 1e-9) return null
  const req: SettleRequest = { id: uid('sr'), amount: round2(amount), status: 'pending', at }
  return { ...s, settleReqs: [req, ...s.settleReqs] }
}

/** 平台推进：pending→approved（放行冻结）/rejected（驳回）；approved→processing（扣减收益）；
    processing→sent；sent→paid 到账 / failed 失败退回（收益回池）。终态与越级一律原样返回。 */
export function applySettleAdvance(s: WalletState, id: string, to: SettleStatus): WalletState {
  const req = s.settleReqs.find(r => r.id === id)
  if (!req || req.status === to) return s
  const allowed: Record<SettleStatus, SettleStatus[]> = {
    pending: ['approved', 'rejected'],
    approved: ['processing'],
    processing: ['sent'],
    sent: ['paid', 'failed'],
    paid: [], failed: [], rejected: [],
  }
  if (!allowed[req.status].includes(to)) return s
  let earnings = s.earnings
  if (to === 'processing') earnings = round2(Math.max(0, earnings - req.amount))
  if (to === 'failed') earnings = round2(earnings + req.amount)
  return { ...s, earnings, settleReqs: s.settleReqs.map(r => r.id === id ? { ...r, status: to } : r) }
}

/** 近 30 天收益汇总（单币种） */
export function earnings30d(s: WalletState): { net: number; gross: number; fee: number } {
  const since = now() - 30 * 86400000
  const rows = s.earningLedger.filter(l => l.kind === 'earning' && l.at >= since)
  const pick = (key: 'amount' | 'gross' | 'fee') => round2(rows.reduce((sum, l) => sum + (l[key] || 0), 0))
  return { net: pick('amount'), gross: pick('gross'), fee: pick('fee') }
}

/* ------------------------------------------------------------------ 实例引擎（真实钟推进） */

/* 过渡态时长（ms）：真实节奏下可见 Creating→Loading→Connecting→Running 流转 */
const PHASE = { creating: 15000, loading: 10000, connecting: 8000, reboot: 30000 }
/* 停机存储费 $/GB·h（≈0.16/月/GB 演示口径）：Inactive/Expired 持续计费 */
export const STORE_PER_GB_H = 0.00022
/* 宿主断连违约阈值：超时强制终止、余款全退（租户无责） */
export const OFFLINE_BREACH_MS = 5 * 60000
/* 计费落账阈值：acc 攒到此值即扣余额并落一笔流水（与资金页余额列严格同步） */
const LEDGER_FLUSH = 0.01
/* 单次推进上限：离开实例页期间不追溯计费，回来最多补 1 分钟 */
const TICK_CAP_MS = 60000

const RUNNING_LIKE = ['Creating', 'Loading', 'Connecting', 'Running', 'Rebooting'] as const
const orderDurationMs = (o: OrderRow) => (o.hours ?? 0) * 3600000

/** 引擎推进：状态机 + 计费 + 欠费停机 + 违约出列。纯函数，实例页每秒调用。 */
export function applyTick(s: WalletState, at = now()): WalletState {
  const dt = s.tickAt ? Math.min(Math.max(at - s.tickAt, 0), TICK_CAP_MS) : 0
  if (!s.orders.length) return { ...s, tickAt: at }

  const orders = s.orders.map(o => ({ ...o }))
  const rows: LedgerRow[] = []
  let balance = s.balance
  const breached: string[] = []

  for (const o of orders) {
    /* 1) 公共过渡态推进（phaseUntil = 当前态截止时刻） */
    for (let guard = 0; guard < 5; guard++) {
      if (o.status === 'Creating' && at >= (o.phaseUntil ?? 0)) { o.status = 'Loading'; o.phaseUntil = (o.phaseUntil ?? at) + PHASE.loading; continue }
      if (o.status === 'Loading' && at >= (o.phaseUntil ?? 0)) { o.status = 'Connecting'; o.phaseUntil = (o.phaseUntil ?? at) + PHASE.connecting; continue }
      if (o.status === 'Connecting' && at >= (o.phaseUntil ?? 0)) { o.status = 'Running'; o.phaseUntil = undefined; continue }
      if (o.status === 'Rebooting' && at >= (o.phaseUntil ?? 0)) { o.status = 'Running'; o.phaseUntil = undefined; continue }
      break
    }

    /* 2) 时段订单分支：预付封闭，摊销只划 escrowHold/amortized，不扣余额 */
    if (o.contractType === 'order') {
      if (o.status === 'Reserved') {
        if (at >= (o.phaseUntil ?? 0)) { o.status = 'Creating'; o.phaseUntil = at + PHASE.creating }
        continue
      }
      if (o.status === 'Offline') {
        /* 宿主断连：租户未获得服务，到期时刻顺延；超时违约＝强制终止 + 余款全退 */
        if (o.rentalEnd) o.rentalEnd += dt
        if (o.offlineAt && at - o.offlineAt > OFFLINE_BREACH_MS) breached.push(o.id)
        continue
      }
      if (o.rentalEnd && at >= o.rentalEnd && o.status !== 'Expired' && o.status !== 'Destroyed') {
        /* 到期：残值退还（正常摊销完 ≈ 0），状态转 Expired 保留展示 */
        const rest = round2(o.escrowHold)
        if (rest > 0.0001) {
          balance = round2(balance + rest)
          rows.push({ id: uid('l'), kind: 'refund', amount: rest, at, label: o.machine, balAfter: balance, into: true })
          o.escrowHold = 0
        }
        o.status = 'Expired'
        continue
      }
      if (RUNNING_LIKE.includes(o.status as typeof RUNNING_LIKE[number])) {
        const am = o.dph * dt / orderDurationMs(o)
        o.amortized = round2(o.amortized + am)
        o.escrowHold = Math.max(0, round2(o.escrowHold - am))
      }
      continue
    }

    /* 3) 按量分支：排队解决 + 计费落账（GPU 时长 + 带宽容量占用，v3.9 段结算口径） */
    if (o.status === 'Scheduling' && at >= (o.resolveAt ?? 0)) o.status = 'Running'
    const runningLike = o.status === 'Running' || o.status === 'Rebooting'
    const rate = runningLike ? o.dph + specOf(o.machine).bwMbps * RATE_BW_MBPS_H
      : (o.status === 'Inactive' || o.status === 'Expired') ? o.diskGb * STORE_PER_GB_H : 0
    if (rate > 0) {
      const amt = rate * dt / 3600000
      o.acc = o.acc + amt
      o.spentTotal = round2(o.spentTotal + amt)
      if (o.acc >= LEDGER_FLUSH) {
        const settled = +o.acc.toFixed(4)
        o.acc = 0
        balance = round2(balance - settled)
        rows.push({ id: uid('l'), kind: 'consume', amount: settled, at, label: o.machine, balAfter: balance,
          billType: runningLike ? 'gpu' : 'storage' })
      }
    }
    if (o.status === 'Offline' && o.offlineAt && at - o.offlineAt > OFFLINE_BREACH_MS) breached.push(o.id)
  }

  /* 4) 欠费停机（仅按量；时段订单预付封闭不受影响） */
  if (balance <= 0 && orders.some(o => o.contractType === 'ondemand' && ['Running', 'Loading', 'Connecting', 'Scheduling'].includes(o.status))) {
    orders.forEach(o => {
      if (o.contractType === 'ondemand' && ['Running', 'Loading', 'Connecting', 'Scheduling'].includes(o.status)) {
        o.status = 'Inactive'
        o.debtStopped = true
      }
    })
  }

  /* 5) 违约出列：订单余款全退（免罚金，租户无责），按量无预付直接移除 */
  const survivors = orders.filter(o => !breached.includes(o.id))
  let bal = balance
  const breachRefunds: LedgerRow[] = []
  for (const id of breached) {
    const o = orders.find(x => x.id === id)
    if (o?.contractType === 'order' && o.escrowHold > 0.0001) {
      const rest = round2(o.escrowHold)
      bal = round2(bal + rest)
      breachRefunds.push({ id: uid('l'), kind: 'refund', amount: rest, at, label: o.machine, balAfter: bal, into: true })
    }
  }
  return {
    ...s,
    tickAt: at,
    balance: bal,
    orders: survivors,
    ledger: [...rows, ...breachRefunds, ...s.ledger].slice(0, 60),
  }
}

/* —— 实例操作（页面按钮 → 纯操作，资金变动全部走这里）—— */

const patchOrder = (s: WalletState, id: string, patch: Partial<OrderRow>): WalletState => ({
  ...s,
  orders: s.orders.map(o => o.id === id ? { ...o, ...patch } : o),
})

/** 行内改名 */
export function applyInstLabel(s: WalletState, id: string, label: string): WalletState {
  return patchOrder(s, id, { label: label.trim() || undefined })
}

/** 停机 / 取消排队（按量专属：订单租期内物理卡不可中断，不渲染 Stop） */
export function applyInstStop(s: WalletState, id: string): WalletState {
  return patchOrder(s, id, { status: 'Inactive', debtStopped: false, stuck: false, stuckHint: false, offlineAt: undefined })
}

/** 重启（Running → Rebooting，期间正常计费） */
export function applyInstReboot(s: WalletState, id: string, at = now()): WalletState {
  return patchOrder(s, id, { status: 'Rebooting', phaseUntil: at + PHASE.reboot })
}

/** 启动（Inactive → Creating 重新开机）：市场显示「可租」即资源已锁定，
    不再引入排队态——排队与「我已经租到这台机器」自相矛盾。 */
export function applyInstStart(s: WalletState, id: string, at = now()): WalletState {
  return patchOrder(s, id, { status: 'Creating', debtStopped: false, stuck: false, stuckHint: false, phaseUntil: at + PHASE.creating, resolveAt: undefined, offlineAt: undefined })
}

/** 销毁：记录保留为「已销毁」（灰态只读，租客可回看租过什么、共花多少）；
    退款/罚金照常落账。按量/已到期无退；预定单到点前取消全款退；订单提前取消退 85% + 15% 罚金流水。 */
export function applyInstDestroy(s: WalletState, id: string, at = now()): WalletState {
  const o = s.orders.find(x => x.id === id)
  if (!o) return s
  /* 记录保留：清掉运行期字段，状态转 Destroyed（引擎与操作都不再接管它） */
  const rest: WalletState = {
    ...s,
    orders: s.orders.map(x => x.id === id
      ? { ...x, status: 'Destroyed' as const, destroyedAt: at, escrowHold: 0, phaseUntil: undefined, resolveAt: undefined, offlineAt: undefined, debtStopped: false, stuck: false, stuckHint: false, acc: 0 }
      : x),
  }
  if (o.contractType === 'ondemand' || o.status === 'Expired') return rest
  const hold = round2(o.escrowHold)
  if (hold <= 0.0001) return rest
  if (o.status === 'Reserved') {
    const balance = round2(s.balance + hold)
    return { ...rest, balance, ledger: [{ id: uid('l'), kind: 'refund' as const, amount: hold, at, label: o.machine, balAfter: balance, into: true }, ...s.ledger].slice(0, 60) }
  }
  const refund = round2(hold * 0.85)
  const penalty = round2(hold - refund)
  const balance = round2(s.balance + refund)
  const ledger: LedgerRow[] = [
    ...(penalty > 0.0001 ? [{ id: uid('l'), kind: 'penalty' as const, amount: penalty, at, label: o.machine, balAfter: balance }] : []),
    { id: uid('l'), kind: 'refund' as const, amount: refund, at, label: o.machine, balAfter: balance, into: true },
    ...s.ledger,
  ].slice(0, 60)
  return { ...rest, balance, ledger }
}
