/* ============================================================================
   资金账本（资金页 / 收益页 / 租用确认页共用）
   · 两池独立记账：法币（Airwallex）与链上（Infini）余额、收益互不交叉
   · 订单扣款只落单池：校验、扣款、取消退款都针对同一池，不做两池合计
   · 订单取消：退款只回平台余额（原扣款池），不触第三方、不产生通道退款
   · 收益入账：先进持有期，结算窗口过后自动转可提现（演示 20 秒）
   · 账本跟着账户走：存储 key 带邮箱，换账号登录看到另一套数据
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'

export type Rail = 'fiat' | 'crypto'

/* 出金状态按通道分流（对齐两家真实状态机）：
   · 法币（Airwallex）：scheduled → processing → sent → paid，另有 failed / cancelled
   · 链上（Infini）：pending → processing → completed，另有 failed（原链退回）
   扣款点两通道都在 processing；failed 时已扣金额退回原池。 */
export type PayoutStatus =
  | 'scheduled' | 'sent' | 'paid' | 'cancelled'
  | 'pending' | 'processing' | 'completed'
  | 'failed'

export type PayoutAccount = {
  id: string
  rail: Rail
  label: string
  bank?: string
  tail?: string
  chain?: string
  address?: string
  verified: 'match' | 'partial' | 'nomatch'
  isDefault?: boolean
}

export type PayoutRequest = {
  id: string
  rail: Rail
  account: string
  amount: number
  status: PayoutStatus
  deducted?: boolean
  refunded?: boolean
  at: number
}

/* 流水：kind 决定说明文案（渲染时按语言翻译）；label 携带机器等中立信息；
   balAfter 记录该池流水后余额；gross/fee 仅宿主收益行使用。 */
export type LedgerKind = 'topup' | 'consume' | 'refund' | 'earning' | 'payout'
export type LedgerRow = {
  id: string
  rail: Rail
  kind: LedgerKind
  amount: number
  at: number
  label?: string
  balAfter?: number
  gross?: number
  fee?: number
}

export type OrderRow = {
  id: string
  machine: string
  amount: number
  pool: Rail
  /* provisioned：支付即开通（自动开通无需审核），订单交割完成、退款走控制台销毁实例 */
  status: 'open' | 'provisioned' | 'cancelled'
  hours?: number
  at: number
}

export type HoldEntry = { id: string; rail: Rail; amount: number; expireT: number }

export type WalletState = {
  balance: Record<Rail, number>
  earnings: Record<Rail, number>
  held: Record<Rail, number>
  holdQueue: HoldEntry[]
  ledger: LedgerRow[]
  payouts: PayoutRequest[]
  accounts: PayoutAccount[]
  orders: OrderRow[]
}

export const DEMO_EMAIL = 'demo@demo.dev'
export const CHANNEL: Record<Rail, string> = { fiat: 'Airwallex', crypto: 'Infini' }
export const MIN_TOPUP: Record<Rail, number> = { fiat: 16, crypto: 10 }
export const MIN_PAYOUT = 20
export const RAIL_LABEL = {
  zh: { fiat: '法币池', crypto: '链上池' },
  en: { fiat: 'Fiat pool', crypto: 'On-chain pool' },
} as const

export const now = () => Date.now()
export const money = (v: number) => `$${(+v || 0).toFixed(2)}`
export const stamp = (at: number) => {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const round2 = (v: number) => +v.toFixed(2)
const uid = (p: string) => `${p}-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
/** 供调用方先生成订单号再落账（确认页支付用） */
export const newId = uid
const zeroPools = (): Record<Rail, number> => ({ fiat: 0, crypto: 0 })

const walletKey = (email: string) => `mk-site-wallet:${email}`

function seedWallet(email: string): WalletState {
  if (email !== DEMO_EMAIL) {
    return { balance: zeroPools(), earnings: zeroPools(), held: zeroPools(), holdQueue: [], ledger: [], payouts: [], accounts: [], orders: [] }
  }
  const d = 86400000
  const h = 3600000
  return {
    balance: { fiat: 18.4, crypto: 20 },
    earnings: { fiat: 60, crypto: 20 },
    held: zeroPools(),
    holdQueue: [],
    ledger: [
      { id: 'l-seed-1', rail: 'fiat', kind: 'consume', amount: 21.6, at: now() - 2 * h, label: 'M-05904012 · RTX 5090 ×2', balAfter: 18.4 },
      { id: 'l-seed-2', rail: 'fiat', kind: 'refund', amount: 12, at: now() - 1 * d - 2 * h, label: 'M-03011042 · H200 NVL ×1', balAfter: 40 },
      { id: 'l-seed-3', rail: 'fiat', kind: 'consume', amount: 12, at: now() - 1 * d - 4 * h, label: 'M-03011042 · H200 NVL ×1', balAfter: 28 },
      { id: 'l-seed-4', rail: 'fiat', kind: 'topup', amount: 40, at: now() - 2 * d - 2 * h, balAfter: 40 },
      { id: 'l-seed-5', rail: 'crypto', kind: 'refund', amount: 20, at: now() - 3 * d, label: 'M-01114008 · A100 ×4', balAfter: 20 },
      { id: 'l-seed-6', rail: 'crypto', kind: 'consume', amount: 20, at: now() - 3 * d - 1 * h, label: 'M-01114008 · A100 ×4', balAfter: 0 },
      { id: 'l-seed-7', rail: 'crypto', kind: 'topup', amount: 20, at: now() - 3 * d - 2 * h, balAfter: 20 },
      { id: 'l-seed-8', rail: 'crypto', kind: 'earning', amount: 60, gross: 64, fee: 4, at: now() - 6 * d, balAfter: 60 },
      { id: 'l-seed-9', rail: 'crypto', kind: 'payout', amount: 40, at: now() - 5 * d - 1 * h, balAfter: 20 },
      { id: 'l-seed-10', rail: 'fiat', kind: 'earning', amount: 180, gross: 200, fee: 20, at: now() - 7 * d, balAfter: 180 },
      { id: 'l-seed-11', rail: 'fiat', kind: 'payout', amount: 120, at: now() - 5 * d, balAfter: 60 },
    ],
    payouts: [
      { id: 'w-seed-1', rail: 'crypto', account: 'TRON wallet · •••• 0000', amount: 40, status: 'completed', deducted: true, at: now() - 5 * d - 1 * h },
      { id: 'w-seed-2', rail: 'fiat', account: 'Demo Host Ltd · •••• 7710', amount: 120, status: 'paid', deducted: true, at: now() - 5 * d },
    ],
    accounts: [
      { id: 'pa-1', rail: 'fiat', label: 'Demo Host Ltd', bank: 'DBS Bank', tail: '7710', verified: 'match', isDefault: true },
      { id: 'pa-2', rail: 'crypto', label: 'TRON wallet', chain: 'TRON', address: 'TQ5xDemoWalletAddress0000000000', tail: '0000', verified: 'match', isDefault: true },
    ],
    orders: [
      { id: 'o-seed-3', machine: 'M-05904012 · RTX 5090 ×2', amount: 21.6, pool: 'fiat', status: 'open', at: now() - 2 * h },
      { id: 'o-seed-2', machine: 'M-03011042 · H200 NVL ×1', amount: 12, pool: 'fiat', status: 'cancelled', at: now() - 1 * d - 4 * h },
      { id: 'o-seed-1', machine: 'M-01114008 · A100 ×4', amount: 20, pool: 'crypto', status: 'cancelled', at: now() - 3 * d - 1 * h },
    ],
  }
}

export function loadWallet(email: string): WalletState {
  const base = seedWallet(email)
  try {
    const raw = localStorage.getItem(walletKey(email))
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<WalletState>
    return {
      balance: { ...base.balance, ...(saved.balance || {}) },
      earnings: { ...base.earnings, ...(saved.earnings || {}) },
      held: { ...base.held, ...(saved.held || {}) },
      holdQueue: Array.isArray(saved.holdQueue) ? saved.holdQueue : base.holdQueue,
      ledger: Array.isArray(saved.ledger) ? saved.ledger : base.ledger,
      payouts: Array.isArray(saved.payouts) ? saved.payouts : base.payouts,
      accounts: Array.isArray(saved.accounts) ? saved.accounts : base.accounts,
      orders: Array.isArray(saved.orders) ? saved.orders : base.orders,
    }
  } catch {
    return base
  }
}

function saveWallet(email: string, state: WalletState) {
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
  return { ...s, ledger: [row, ...s.ledger].slice(0, 40) }
}

/** 充值入池（演示态：托管收单/链上确认成功后调用） */
export function applyTopup(s: WalletState, rail: Rail, amount: number): WalletState {
  const balance = round2(s.balance[rail] + amount)
  return withLedger({ ...s, balance: { ...s.balance, [rail]: balance } },
    { id: uid('l'), rail, kind: 'topup', amount, at: now(), balAfter: balance })
}

/** 订单扣款：只落单池，写消费流水并生成订单（支付即开通 → provisioned，hours 供控制台承接实例时长） */
export function applyPayOrder(s: WalletState, machine: string, pool: Rail, amount: number, orderId = uid('o'), hours = 1): { state: WalletState; order: OrderRow } {
  const balance = round2(s.balance[pool] - amount)
  const order: OrderRow = { id: orderId, machine, amount, pool, status: 'provisioned', hours, at: now() }
  const state = withLedger(
    { ...s, balance: { ...s.balance, [pool]: balance }, orders: [order, ...s.orders] },
    { id: uid('l'), rail: pool, kind: 'consume', amount, at: now(), label: machine, balAfter: balance },
  )
  return { state, order }
}

/** 订单取消：退款回原扣款池，只动平台余额；没有可取消订单时返回 null */
export function applyCancelOrder(s: WalletState, orderId: string): WalletState | null {
  const order = s.orders.find(o => o.id === orderId)
  if (!order || order.status !== 'open') return null
  const balance = round2(s.balance[order.pool] + order.amount)
  return withLedger(
    {
      ...s,
      balance: { ...s.balance, [order.pool]: balance },
      orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' as const } : o),
    },
    { id: uid('l'), rail: order.pool, kind: 'refund', amount: order.amount, at: now(), label: order.machine, balAfter: balance },
  )
}

/** 宿主收益入账：净额先进持有期，到期转可提现 */
export function applyAccrue(s: WalletState, rail: Rail, gross: number, fee: number): WalletState {
  const net = round2(gross - fee)
  const earnings = round2(s.earnings[rail] + net)
  return withLedger(
    {
      ...s,
      earnings: { ...s.earnings, [rail]: earnings },
      held: { ...s.held, [rail]: round2(s.held[rail] + net) },
      holdQueue: [...s.holdQueue, { id: uid('h'), rail, amount: net, expireT: now() + 20000 }],
    },
    { id: uid('l'), rail, kind: 'earning', amount: net, gross, fee, at: now(), balAfter: earnings },
  )
}

/** 持有期到期批量解锁，返回解锁总额（无到期返回 null） */
export function applyHoldUnlock(s: WalletState): { state: WalletState; unlocked: number } | null {
  const due = s.holdQueue.filter(entry => entry.expireT <= now())
  if (!due.length) return null
  const held = { ...s.held }
  due.forEach(entry => { held[entry.rail] = Math.max(0, round2(held[entry.rail] - entry.amount)) })
  return { state: { ...s, held, holdQueue: s.holdQueue.filter(entry => entry.expireT > now()) }, unlocked: round2(due.reduce((sum, e) => sum + e.amount, 0)) }
}

/** 可提现 = 收益池 − 持有期 − 在途冻结（scheduled/pending 未扣款的申请） */
export function withdrawable(s: WalletState, rail: Rail): number {
  const frozen = s.payouts
    .filter(r => r.rail === rail && (r.status === 'scheduled' || r.status === 'pending') && !r.deducted)
    .reduce((sum, r) => sum + r.amount, 0)
  return Math.max(0, round2(s.earnings[rail] - s.held[rail] - frozen))
}

/** 提交出金申请：法币排程、链上待处理；同一时刻仅一笔在途由页面校验 */
export function applyPayoutSubmit(s: WalletState, rail: Rail, accountLabel: string, amount: number): WalletState {
  const status: PayoutStatus = rail === 'fiat' ? 'scheduled' : 'pending'
  return { ...s, payouts: [{ id: uid('w'), rail, account: accountLabel, amount, status, at: now() }, ...s.payouts] }
}

/** 推进出金状态：processing 扣款，failed 退回原池，paid/completed 写出金到账流水 */
export function applyPayoutAdvance(s: WalletState, id: string, to: PayoutStatus): WalletState {
  const req = s.payouts.find(r => r.id === id)
  if (!req) return s
  let earnings = s.earnings
  if (to === 'processing' && !req.deducted) earnings = { ...earnings, [req.rail]: round2(earnings[req.rail] - req.amount) }
  if (to === 'failed' && req.deducted && !req.refunded) earnings = { ...earnings, [req.rail]: round2(earnings[req.rail] + req.amount) }
  let next: WalletState = {
    ...s,
    earnings,
    payouts: s.payouts.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, status: to }
      if (to === 'processing' && !r.deducted) updated.deducted = true
      if (to === 'failed' && r.deducted && !r.refunded) updated.refunded = true
      return updated
    }),
  }
  if (to === 'paid' || to === 'completed') {
    next = withLedger(next, { id: uid('l'), rail: req.rail, kind: 'payout', amount: req.amount, at: now(), balAfter: round2(earnings[req.rail]) })
  }
  return next
}

/** 保存收款账户（同 id 替换，其余保持默认位） */
export function applyAccountSave(s: WalletState, account: PayoutAccount): WalletState {
  return { ...s, accounts: [...s.accounts.filter(a => a.id !== account.id), account] }
}

/** 近 30 天收益汇总：净额、毛收入、平台抽成 */
export function earnings30d(s: WalletState): { net: number; gross: number; fee: number } {
  const since = now() - 30 * 86400000
  const rows = s.ledger.filter(l => l.kind === 'earning' && l.at >= since)
  const pick = (key: 'amount' | 'gross' | 'fee') => round2(rows.reduce((sum, l) => sum + (l[key] || 0), 0))
  return { net: pick('amount'), gross: pick('gross'), fee: pick('fee') }
}
