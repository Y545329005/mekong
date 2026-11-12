/* ============================================================================
   运营后台聚合层（AdminPage 专用 · 演示态）
   · 钱包按邮箱分桶（mk-site-wallet:<email>），后台遍历全桶得到平台视图
   · 只读聚合 + 实例运维写桶：写前重新 loadWallet（不用过期快照整写回）
   · 对账口径（守恒公式）：
       租客侧  Σ支付单入账 = 可用 + 已消费 + 已退 + 已提（FIFO 摊账保证闭合）
       宿主侧  Σ订单金额(gross) = Σ净入账(net) + Σ平台费用(fee)（逐行成立）
     罚金是平台收入项（不入宿主收益），单列呈现；抽成即 fee，已含在宿主流水。
   · 局限：admin 写用户桶后，对客页不监听 storage，刷新后可见（演示口径）
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { loadWallet, saveWallet, lotAvailable, settleable, applySettleAdvance, settleNo, DEMO_EMAIL } from './wallet/store'
import type { WalletState, LedgerRow, OrderRow, LedgerKind, SettleRequest, SettleStatus } from './wallet/store'
import { HOST_MACHINES } from './hostMachines'

/* 运营身份（演示）：登录层任意邮箱可进，后台面板以邮箱白名单闸住 */
export const ADMIN_EMAIL = 'admin@demo.dev'

const WALLET_PREFIX = 'mk-site-wallet:'
const CONFIG_KEY = 'mk-site-config'

/* 平台抽成（全局参数，admin 系统配置页可调）：仅影响此后新收益的 fee 落账，
   历史流水不篡改（逐笔 fee 已固化）。 */
export const RATE_MIN = 0
export const RATE_MAX = 0.2
export const RATE_DEFAULT = 0.1

export function readRate(): number {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    const cfg = raw ? JSON.parse(raw) as { rate?: number } : null
    const rate = Number(cfg?.rate)
    return Number.isFinite(rate) ? Math.min(RATE_MAX, Math.max(RATE_MIN, rate)) : RATE_DEFAULT
  } catch { return RATE_DEFAULT }
}

export function writeRate(rate: number) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ rate: Math.min(RATE_MAX, Math.max(RATE_MIN, rate)) })) } catch { /* 隐私模式下不落盘 */ }
}

/* 企业线索（SalesPage 提交落盘，后台读侧展示） */
export const LEADS_KEY = 'mk-site-leads'

export type Lead = {
  at: number
  purpose: string[]
  gpu: string[]
  quantity: string
  duration: string
  usageCountry: string[]
  company: string
  companyCountry: string
  contact: string
  email: string
  requirements: string
}

const LEAD_CAP = 50

export function saveLead(draft: Omit<Lead, 'at'>) {
  try {
    const raw = localStorage.getItem(LEADS_KEY)
    const list: Lead[] = raw ? JSON.parse(raw) as Lead[] : []
    localStorage.setItem(LEADS_KEY, JSON.stringify([{ ...draft, at: Date.now() }, ...list].slice(0, LEAD_CAP)))
  } catch { /* 隐私模式下不落盘，不影响提交流程 */ }
}

export function loadLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_KEY)
    const list = raw ? JSON.parse(raw) as Lead[] : []
    return Array.isArray(list) ? list.filter(row => row && typeof row.at === 'number') : []
  } catch { return [] }
}

/* ------------------------------------------------------------------ 操作留痕 */

export type AdminLog = {
  at: number
  /* instance.stop 为历史动作类型（强停能力已按 P2P 口径移除），保留用于读取旧留痕；
     admin.* 为管理员账户管理留痕（名单演示态存本机浏览器） */
  action: 'settle.advance' | 'instance.stop' | 'rate.update' | 'admin.add' | 'admin.status' | 'admin.remove'
  target: string
  detail?: string
  /* 操作人：写入时自动取运营账号（历史记录缺该字段，展示层回退 ADMIN_EMAIL） */
  operator?: string
}

/* --------------------------------------------------- 管理员账户名单（演示态） */

export type AdminRole = 'super' | 'finance' | 'compliance' | 'viewer'
export type AdminAccount = { email: string; role: AdminRole; status: 'active' | 'disabled'; addedAt: number }

const ADMINS_KEY = 'mk-site-admins'
/* 名单空/损坏时回落内置超管，保证任何情况下至少有一个可进后台的账号 */
const seedAdmins = (): AdminAccount[] => [{ email: ADMIN_EMAIL, role: 'super', status: 'active', addedAt: 0 }]
const normEmail = (email: string) => email.trim().toLowerCase()

export function loadAdmins(): AdminAccount[] {
  try {
    const raw = localStorage.getItem(ADMINS_KEY)
    if (!raw) return seedAdmins()
    const list = JSON.parse(raw) as AdminAccount[]
    return Array.isArray(list) && list.some(a => a && typeof a.email === 'string' && typeof a.role === 'string')
      ? list.filter(a => a && typeof a.email === 'string' && typeof a.role === 'string')
      : seedAdmins()
  } catch { return seedAdmins() }
}

function saveAdmins(list: AdminAccount[]) {
  try { localStorage.setItem(ADMINS_KEY, JSON.stringify(list)) } catch { /* 隐私模式下不落盘 */ }
}

/** 添加管理员：轻校验 + 去重；成功返回 null，否则错误码（展示层翻译） */
export function adminAdd(email: string, role: AdminRole): 'exists' | 'invalid' | null {
  const norm = normEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return 'invalid'
  const list = loadAdmins()
  if (list.some(a => a.email === norm)) return 'exists'
  saveAdmins([{ email: norm, role, status: 'active', addedAt: Date.now() }, ...list])
  pushAdminLog({ action: 'admin.add', target: norm, detail: role })
  return null
}

/** 停用/启用：拦「最后一个启用的超级管理员」被停用（防自锁） */
export function adminSetStatus(email: string, status: AdminAccount['status']): boolean {
  const norm = normEmail(email)
  const list = loadAdmins()
  const acct = list.find(a => a.email === norm)
  if (!acct || acct.status === status) return false
  if (acct.role === 'super' && acct.status === 'active' && status === 'disabled'
    && list.filter(a => a.role === 'super' && a.status === 'active').length <= 1) return false
  saveAdmins(list.map(a => a.email === norm ? { ...a, status } : a))
  pushAdminLog({ action: 'admin.status', target: norm, detail: status })
  return true
}

/** 移除（终态）：同拦最后一个启用超管；自账号移除由 UI 层拦（当前登录者） */
export function adminRemove(email: string): boolean {
  const norm = normEmail(email)
  const list = loadAdmins()
  const acct = list.find(a => a.email === norm)
  if (!acct) return false
  if (acct.role === 'super' && acct.status === 'active'
    && list.filter(a => a.role === 'super' && a.status === 'active').length <= 1) return false
  saveAdmins(list.filter(a => a.email !== norm))
  pushAdminLog({ action: 'admin.remove', target: norm, detail: acct.role })
  return true
}

const ADMIN_LOG_KEY = 'mk-site-adminlog'
const ADMIN_LOG_CAP = 60

/** 后台写操作落痕：谁（运营账号单角色）何时把哪个对象动了什么。头部最新。 */
export function pushAdminLog(entry: Omit<AdminLog, 'at'>) {
  try {
    const raw = localStorage.getItem(ADMIN_LOG_KEY)
    const list: AdminLog[] = raw ? JSON.parse(raw) as AdminLog[] : []
    localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify([{ operator: ADMIN_EMAIL, ...entry, at: Date.now() }, ...list].slice(0, ADMIN_LOG_CAP)))
  } catch { /* 留痕失败不阻断主操作 */ }
}

export function loadAdminLogs(): AdminLog[] {
  try {
    const raw = localStorage.getItem(ADMIN_LOG_KEY)
    const list = raw ? JSON.parse(raw) as AdminLog[] : []
    return Array.isArray(list) ? list.filter(row => row && typeof row.at === 'number') : []
  } catch { return [] }
}

/* ------------------------------------------------------------------ 桶聚合 */

export type AccountBucket = { email: string; wallet: WalletState }

const hasContent = (w: WalletState) =>
  w.balance !== 0 || w.earnings !== 0 || w.ledger.length > 0 || w.earningLedger.length > 0 ||
  w.payments.length > 0 || w.exits.length > 0 || w.orders.length > 0

/** 全部非空桶（demo 与演示账号桶固定包含：无存档时也有种子数据；
    演示桶首次派生时经 loadWallet 播种落盘，之后随存档走） */
export function collectBuckets(): AccountBucket[] {
  const emails = new Set<string>([DEMO_EMAIL, 'wei@demo.dev', 'corp@demo.dev', 'host@demo.dev'])
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(WALLET_PREFIX)) emails.add(key.slice(WALLET_PREFIX.length))
    }
  } catch { /* 存储不可用时只看 demo 桶 */ }
  return [...emails]
    .map(email => ({ email, wallet: loadWallet(email) }))
    .filter(bucket => hasContent(bucket.wallet))
}

/* ------------------------------------------------------------------ 对账派生 */

export type AdminDerived = {
  /* 资金面 */
  balanceTotal: number
  settleableTotal: number
  heldTotal: number
  approvedFrozen: number
  exitsInFlight: number
  escrowHoldTotal: number
  activeOrders: number
  /* 平台收入（罚金单列 + 抽成即宿主流水的 fee） */
  penaltyTotal: number
  feeTotal: number
  /* 宿主面 */
  earnNet: number
  earnGross: number
  /* 租客侧守恒：Σ支付单入账 vs 可用+已消费+已退+已提 */
  topupTotal: number
  tenantReconDiff: number
  /* 宿主侧守恒：Σgross vs Σ(net+fee) */
  hostReconDiff: number
}

export function derive(buckets: AccountBucket[]): AdminDerived {
  let balanceTotal = 0, settleableTotal = 0, heldTotal = 0, approvedFrozen = 0, exitsInFlight = 0, escrowHoldTotal = 0
  let activeOrders = 0, penaltyTotal = 0, feeTotal = 0, earnNet = 0, earnGross = 0
  let topupTotal = 0, paidTotal = 0
  for (const { wallet: w } of buckets) {
    balanceTotal += w.balance
    heldTotal += w.held
    approvedFrozen += w.settleReqs.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0)
    settleableTotal += settleable(w)
    exitsInFlight += w.exits.filter(r => r.status === 'pending' || r.status === 'processing').reduce((sum, r) => sum + r.amount, 0)
    escrowHoldTotal += w.orders.reduce((sum, o) => sum + (o.escrowHold || 0), 0)
    activeOrders += w.orders.filter(o => o.status !== 'Destroyed' && o.status !== 'Expired').length
    penaltyTotal += w.ledger.filter(l => l.kind === 'penalty').reduce((sum, l) => sum + l.amount, 0)
    feeTotal += w.earningLedger.reduce((sum, l) => sum + (l.fee || 0), 0)
    earnNet += w.earningLedger.reduce((sum, l) => sum + l.amount, 0)
    earnGross += w.earningLedger.reduce((sum, l) => sum + (l.gross || 0), 0)
    topupTotal += w.ledger.filter(l => l.kind === 'topup').reduce((sum, l) => sum + l.amount, 0)
    /* 租客侧守恒右端：每张支付单的「已消费+已退+已提+可用」之和 */
    paidTotal += w.payments.reduce((sum, p) => sum + p.consumed + p.refunded + p.withdrawn + lotAvailable(p), 0)
  }
  const round = (v: number) => +v.toFixed(2)
  return {
    balanceTotal: round(balanceTotal),
    settleableTotal: round(settleableTotal),
    heldTotal: round(heldTotal),
    approvedFrozen: round(approvedFrozen),
    exitsInFlight: round(exitsInFlight),
    escrowHoldTotal: round(escrowHoldTotal),
    activeOrders,
    penaltyTotal: round(penaltyTotal),
    feeTotal: round(feeTotal),
    earnNet: round(earnNet),
    earnGross: round(earnGross),
    topupTotal: round(topupTotal),
    tenantReconDiff: round(topupTotal - paidTotal),
    hostReconDiff: round(earnGross - (earnNet + feeTotal)),
  }
}

/* ------------------------------------------------------------------ 明细聚合 */

export type MergedLedger = LedgerRow & { email: string; book: 'tenant' | 'host' }

/** 全平台流水：租客额度账本 + 宿主收益账本合并（单号维度统看），按时间倒序取近期 */
export function mergeLedger(buckets: AccountBucket[], cap = 300): MergedLedger[] {
  return buckets
    .flatMap(b => [
      ...b.wallet.ledger.map(row => ({ ...row, email: b.email, book: 'tenant' as const })),
      ...b.wallet.earningLedger.map(row => ({ ...row, email: b.email, book: 'host' as const })),
    ])
    .sort((a, b) => b.at - a.at)
    .slice(0, cap)
}

/* ------------------------------------------------------------------ 对账明细（按账号） */

export type ReconAccountRow = {
  email: string
  /* 租客侧：Σ支付单入账 = 可用 + 已消费 + 已退 + 已提 */
  tenant: { topup: number; consumed: number; refunded: number; withdrawn: number; available: number; diff: number } | null
  /* 宿主侧：Σ订单金额(gross) = Σ净入账 + Σ平台费用(fee) */
  host: { gross: number; net: number; fee: number; diff: number } | null
}

/** 对账明细：逐账号守恒（只列有租客账或宿主账的账号） */
export function deriveReconAccounts(buckets: AccountBucket[]): ReconAccountRow[] {
  const round = (v: number) => +v.toFixed(2)
  return buckets
    .map(({ email, wallet: w }) => {
      const hasTenant = w.payments.length > 0
      const topup = w.payments.reduce((sum, p) => sum + p.amount, 0)
      const consumed = w.payments.reduce((sum, p) => sum + p.consumed, 0)
      const refunded = w.payments.reduce((sum, p) => sum + p.refunded, 0)
      const withdrawn = w.payments.reduce((sum, p) => sum + p.withdrawn, 0)
      const available = w.payments.reduce((sum, p) => sum + lotAvailable(p), 0)
      const gross = w.earningLedger.reduce((sum, l) => sum + (l.gross || 0), 0)
      const net = w.earningLedger.reduce((sum, l) => sum + l.amount, 0)
      const fee = w.earningLedger.reduce((sum, l) => sum + (l.fee || 0), 0)
      return {
        email,
        tenant: hasTenant ? {
          topup: round(topup), consumed: round(consumed), refunded: round(refunded),
          withdrawn: round(withdrawn), available: round(available),
          diff: round(topup - (consumed + refunded + withdrawn + available)),
        } : null,
        host: w.earningLedger.length > 0 ? {
          gross: round(gross), net: round(net), fee: round(fee),
          diff: round(gross - (net + fee)),
        } : null,
      }
    })
    .filter(row => row.tenant || row.host)
}

/* ------------------------------------------------------------------ 运营面统计 */

export type AdminOpsStats = {
  /* 账号数：有资金或实例的桶 */
  accounts: number
  /* 机器：订单出现过的机器 ∪ 宿主登记的机器（按 id 去重） */
  machines: number
  /* 宿主登记的机器数（HOST_MACHINES 基线）与其中已挂牌数 */
  hostRegistered: number
  listed: number
  /* 累计消费 / 累计租用时长（小时） */
  spentTotal: number
  rentHours: number
  /* 待审结算（单数与金额） */
  pendingSettles: number
  pendingSettleAmount: number
  /* 企业线索 */
  leads: number
}

/** 运营面统计：大盘第二组卡片的数据源（资金面之外的「平台有多大/多忙」） */
export function deriveOps(buckets: AccountBucket[], leadCount: number): AdminOpsStats {
  const machineIds = new Set<string>()
  let spentTotal = 0
  let rentHours = 0
  let pendingSettles = 0
  let pendingSettleAmount = 0
  const now = Date.now()
  for (const { wallet: w } of buckets) {
    for (const o of w.orders) {
      machineIds.add(o.machine)
      /* 订单时长：开通 → 销毁/现在（分钟以下舍入） */
      rentHours += Math.max(0, (o.destroyedAt ?? now) - o.at) / 3600000
    }
    spentTotal += w.ledger.filter(l => l.kind === 'consume').reduce((sum, l) => sum + l.amount, 0)
    for (const r of w.settleReqs) {
      if (r.status === 'pending') { pendingSettles += 1; pendingSettleAmount += r.amount }
    }
  }
  for (const m of HOST_MACHINES) machineIds.add(m.id)
  const listed = HOST_MACHINES.filter(m => m.listed).length
  return {
    accounts: buckets.length,
    machines: machineIds.size,
    hostRegistered: HOST_MACHINES.length,
    listed,
    spentTotal: +spentTotal.toFixed(2),
    rentHours: Math.round(rentHours),
    pendingSettles,
    pendingSettleAmount: +pendingSettleAmount.toFixed(2),
    leads: leadCount,
  }
}

export type EndUseRow = { email: string; order: OrderRow }

/** 全平台在役实例（运维对象）：非终态订单；用途声明列同源读取 order.endUse */
export function collectActiveInstances(buckets: AccountBucket[]): EndUseRow[] {
  return buckets
    .flatMap(b => b.wallet.orders.filter(o => o.status !== 'Destroyed' && o.status !== 'Expired').map(order => ({ email: b.email, order })))
    .sort((a, b) => b.order.at - a.order.at)
}

/* —— 结算审批（批2）—— */

export type SettleRow = { email: string; req: SettleRequest }

/** 全平台结算单（头部最新）：审批台按状态给动作 */
export function collectSettleReqs(buckets: AccountBucket[]): SettleRow[] {
  return buckets
    .flatMap(b => b.wallet.settleReqs.map(req => ({ email: b.email, req })))
    .sort((a, b) => b.req.at - a.req.at)
}

/** 审批推进：写目标桶（写前重读）；推进失败（越级/终态/单不在）返回 false。
    operator 缺省为当前运营账号；渠道回调推进传 'channel'，审计里与人工动作区分 */
export function adminSettleAdvance(email: string, id: string, to: SettleStatus, operator = ADMIN_EMAIL): boolean {
  try {
    const wallet = loadWallet(email)
    const req = wallet.settleReqs.find(r => r.id === id)
    if (!req) return false
    const next = applySettleAdvance(wallet, id, to)
    if (next === wallet) return false
    saveWallet(email, next)
    pushAdminLog({ action: 'settle.advance', target: settleNo(req), detail: `${email} → ${to}`, operator })
    return true
  } catch { return false }
}

/** end-use 声明的后台标签：下单存键（training/inference/…），展示走这里 */
export const ADMIN_END_USE_LABEL: Record<string, { zh: string; en: string }> = {
  training: { zh: 'AI 训练', en: 'AI training' },
  inference: { zh: '模型推理', en: 'Model inference' },
  research: { zh: '科研计算', en: 'Research computing' },
  other: { zh: '其他', en: 'Other' },
}

/** 宿主结算六态的后台标签 */
export const ADMIN_SETTLE_LABEL: Record<SettleStatus, { zh: string; en: string }> = {  pending: { zh: '待审', en: 'Pending' },
  approved: { zh: '已放行 · 冻结', en: 'Approved · held' },
  processing: { zh: '出款中', en: 'Processing' },
  sent: { zh: '已出款', en: 'Sent' },
  paid: { zh: '已到账', en: 'Paid' },
  failed: { zh: '失败退回', en: 'Failed · returned' },
  rejected: { zh: '已驳回', en: 'Rejected' },
}

/* ------------------------------------------------------------------ 准实时 hook */

/** 后台数据源：1s 轮询 + storage 事件（跨 tab 写入即时触发，双通道兜底） */
export function useAdminData() {
  const [data, setData] = useState(() => ({ buckets: collectBuckets(), leads: loadLeads(), logs: loadAdminLogs(), admins: loadAdmins() }))
  const lastJson = useRef('')
  useEffect(() => {
    const refresh = () => {
      const next = { buckets: collectBuckets(), leads: loadLeads(), logs: loadAdminLogs(), admins: loadAdmins() }
      const json = JSON.stringify(next)
      /* 轮询每秒全量读桶，脏检查拦住无变化的重渲染（空闲时不再整树重刷） */
      if (json === lastJson.current) return
      lastJson.current = json
      setData(next)
    }
    refresh()
    const id = setInterval(refresh, 1000)
    window.addEventListener('storage', refresh)
    return () => { clearInterval(id); window.removeEventListener('storage', refresh) }
  }, [])
  return data
}

/** 流水 kind 的后台标签（与资金页说明口径一致，供合并流水表用） */
export const ADMIN_KIND_LABEL = {
  zh: { topup: '充值', consume: '消费', refund: '退款', withdraw: '提现', earning: '收益', penalty: '罚金' },
  en: { topup: 'Top-up', consume: 'Usage', refund: 'Refund', withdraw: 'Withdraw', earning: 'Earning', penalty: 'Penalty' },
} as const satisfies Record<'zh' | 'en', Record<LedgerKind, string>>
