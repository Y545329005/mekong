/* ============================================================================
   THESIS  运营后台回答：平台现在压着多少钱、双边对账是否闭合、哪些实例需要
           干预、谁声明过什么用途、企业线索来了多少。主语是平台与双边。
   SHELL   独立后台应用（admin.html 入口，Vite 多入口构建）：深色侧边栏分区
           导航 + 顶栏，不挂对客官网的 Navigation/footer；会话经 localStorage
           与官网同 origin 共享，闸只放行 ADMIN_EMAIL。
   IA      八分区三组——平台监控（大盘·账务）/ 资金审批（结算·系统配置）/
           运营合规（实例运维·企业线索·操作记录·管理员与角色）。对账并入账务
           （守恒状态条 + 双视图），end-use 留痕并入实例运维（用途列 + 筛选）；
           旧直链 #recon/#enduse 重定向到 #ledger/#ops。
   GATE    未登录 / 非运营账号只看到无权限态，不渲染任何数字（含线索 PII）。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from './content'
import { useSession } from './AuthGate'
import { ADMIN_EMAIL, ADMIN_END_USE_LABEL, ADMIN_KIND_LABEL, ADMIN_SETTLE_LABEL, RATE_MAX, RATE_MIN, adminAdd, adminRemove, adminSettleAdvance, adminSetStatus, collectActiveInstances, collectSettleReqs, derive, deriveOps, deriveReconAccounts, loadAdmins, mergeLedger, pushAdminLog, readRate, useAdminData, writeRate } from './adminStore'
import type { AdminDerived, AdminLog, AdminRole, AdminAccount, AccountBucket, AdminOpsStats, EndUseRow, Lead, MergedLedger, ReconAccountRow, SettleRow } from './adminStore'
import { money, stampFull, settleNo, settleable, MIN_TOPUP, MIN_WITHDRAW, WITHDRAW_FEE_RATE, WITHDRAW_FEE_MIN, REFUND_WINDOW_DAYS, REFUND_COOLING_DAYS } from './wallet/store'
import type { InstanceStatus, LedgerKind, SettleRequest, SettleStatus } from './wallet/store'
import { Badge } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './AdminPage.module.css'

const copy = {
  zh: {
    title: '运营后台',
    gateTitle: '登录运营账号查看后台',
    gateLead: '后台聚合全部账户的资金与实例数据，仅运营账号可见。',
    signIn: '以运营账号进入',
    noAccess: '当前账号无后台权限',
    noAccessLead: (email: string) => `后台仅对运营账号开放。当前登录：${email}。`,
    switchAdmin: '切换为运营账号',
    signOut: '退出登录',
    skipToMain: '跳到主内容',
    overview: '平台大盘',
    balance: '租客余额合计',
    settleable: '可结算合计',
    held: '解冻中',
    activeOrders: '在役实例',
    inFlight: '在途退出',
    platformIncome: '平台收入',
    platformIncomeNote: '抽成 + 罚金单列',
    secondaryGroup: '资金与线索',
    machinesNote: (host: number, listed: number) => `宿主登记 ${host} · 挂牌 ${listed}`,
    spentTotal: '累计消费',
    leadsCard: '企业线索',
    pendingSettle: '待审结算',
    pendingSettleNote: (n: number) => `${n} 笔在审`,
    pendingSettleNone: '无在审',
    colBook: '账本',
    bookTenant: '租客',
    bookHost: '宿主',
    detail: '详情',
    detailClose: '收起',
    pagePrev: '上一页',
    pageNext: '下一页',
    pageInfo: (page: number, pages: number, total: number) => `第 ${page}/${pages} 页 · 共 ${total} 条`,
    filterTicket: '单号',
    filterAccount: '账号',
    filterAllKinds: '全部类型',
    filterAllBooks: '全部账本',
    filteredEmpty: '没有符合筛选条件的流水。',
    filterSearchOps: '搜索账号、实例 ID 或机器',
    filterAllStatus: '全部状态',
    filterAllUses: '全部用途',
    filteredEmptyOps: '没有符合筛选条件的实例。',
    colConsumed: '已消费',
    colRefunded: '已退',
    colWithdrawn: '已提',
    colAvailable: '可用',
    colDiff: '差异',
    colGross: '订单金额',
    colNet: '净入账',
    colFee: '平台费用',
    totalRow: '合计',
    exportCsv: '导出 CSV',
    approvedNote: (v: string) => `含放行冻结 ${v}（审批通过未出款）`,
    rate: '平台抽成',
    rateLead: '调整即时生效，仅影响此后新收益的费率落账，历史流水不篡改。',
    rateInputLabel: '抽成百分比',
    toastRateInvalid: (min: number, max: number) => `请输入 ${min}–${max} 的整数百分比`,
    colBasis: '审批依据',
    basisPool: '收益池',
    terminal: '— 终态',
    settle: '结算审批',
    settleLead: '运营只做审批与发起出款；出款后的「已出款 / 到账 / 失败」由渠道回调驱动，不手工标记。',
    colNo: '单号',
    actApprove: '批准',
    actReject: '驳回',
    actProcess: '发起出款',
    waitingCallback: '等待渠道回调…',
    waitingPaid: '等待到账回调…',
    simulateFail: '模拟回调失败',
    toastProcessed: '已提交渠道，等待回调',
    operatorChannel: '渠道回调',
    emptySettle: '还没有结算申请；宿主在收益页提交结算后此处出现待审单。',
    finance: '账务',
    financeLead: '平台资金入口：流水统看与守恒校验。',
    users: '用户管理',
    usersLead: '平台全部主体档案：身份、注册、名下机器与活跃概况。',
    uDetail: '详情',
    uClose: '关闭',
    machinesActive: '在役',
    colMachineLabel: '机器',
    colStartedAt: '启动时间',
    colIdentity: '身份',
    colJoined: '注册时间',
    colMachines: '名下机器',
    colActiveAt: '最近活跃',
    roleTenant: '租客',
    roleHost: '宿主',
    uFunds: '资金概况',
    uMachines: '名下机器',
    uRecent: '最近流水',
    uViewAll: '查看完整流水',
    uNoMachines: '无机器记录',
    uTabTenant: '租客侧',
    uTabHost: '宿主侧',
    uCollapse: '收起',
    uExpandAll: (n: number) => `展开全部 ${n} 台`,
    uSettleable: '可结算',
    uSettleInFlight: '在途结算',
    uSettleRecords: '结算记录',
    uNoSettle: '暂无结算记录',
    colAt: '时间',
    hostEarnTotal: '宿主累计收益',
    gmvNote: '＝ 平台 GMV',
    colBalance: '余额',
    colEarningTotal: '宿主收益',
    viewLedger: '查看流水',
    ledger: '流水',
    ledgerLead: '各账户近期流水的合并视图，余额列为该笔之后的余额。',
    recon: '对账明细',
    tenantRecon: '租客侧守恒',
    tenantFormula: 'Σ 支付单入账 = 可用 + 已消费 + 已退 + 已提',
    topup: '支付单入账',
    allocated: '已分配合计',
    hostRecon: '宿主侧守恒',
    hostFormula: 'Σ 订单金额 = Σ 净入账 + Σ 平台费用',
    gross: '订单金额',
    netFee: '净入账 + 平台费用',
    reconDiff: '差额',
    reconDiffReview: '待核查',
    reconCheckHint: '守恒存在差异，请到对账明细逐账号核查',
    diffNote: '差异 ≤ $0.01 视为闭合（浮点容差）。',
    escrowNote: (hold: string) => `另有序单预付冻结 ${hold} 不在租客余额内（订单 SKU escrow）。`,
    ops: '实例运维',
    opsLead: '只读观测：实例与消费归宿主与租客；平台不介入运行中的实例。',
    colAccount: '账号',
    colInstance: '实例',
    colStatus: '状态',
    colSpent: '累计消费',
    colAct: '操作',
    emptyOps: '当前没有在役实例。',
    colTime: '时间',
    colUse: '用途声明',
    colKind: '类型',
    colAmount: '金额',
    colBalAfter: '余额后',
    holdUntil: '解冻时点',
    colDesc: '说明',
    emptyLedger: '暂无流水。',
    leads: '企业线索',
    leadsLead: '企业算力需求表单提交留痕（contact-sales）。',
    colCompany: '企业',
    colContact: '联系人',
    colEmail: '邮箱',
    colPurpose: '用途',
    colGpu: '卡型 / 数量',
    colReq: '需求',
    emptyLeads: '还没有企业线索；提交企业需求表单后此处出现记录。',
    groupMonitor: '平台监控',
    groupFunds: '资金审批',
    groupOps: '运营合规',
    config: '系统配置',
    roles: '管理员与角色',
    rolesLead: '权限矩阵驱动全后台：导航按角色过滤、写操作按矩阵拦截；账户名单为本机演示态，由超级管理员维护。',
    roleSuper: '超级管理员',
    roleFinance: '财务运营',
    roleCompliance: '合规审查',
    roleViewer: '只读观察',
    permRo: '只读',
    permYesLabel: '可写',
    permNoLabel: '不可见',
    roleNow: '当前生效',
    roleSuperDesc: '全部权限，含管理员与角色',
    roleFinanceDesc: '结算推进、费率与账务',
    roleComplianceDesc: '实例、线索与留痕',
    roleViewerDesc: '全站只读，不含配置',
    colSection: '分区',
    colRole: '角色',
    colAdded: '添加时间',
    statusActive: '启用',
    statusDisabled: '已停用',
    acctBuiltin: '内置',
    acctTitle: '管理员账户',
    acctLead: '名单保存在本机浏览器（演示态），由超级管理员维护；权限矩阵同时驱动本页展示与全后台的导航、写操作拦截。',
    acctEmailPh: 'name@company.dev',
    acctSubmit: '添加',
    acctDisable: '停用',
    acctEnable: '启用',
    acctRemove: '移除',
    confirmRemove: '确认移除',
    toastAcctAdded: (email: string) => `已添加管理员 ${email}`,
    toastAcctRemoved: (email: string) => `已移除 ${email}`,
    errAcctExists: '该邮箱已在管理员名单',
    errAcctInvalid: '请输入有效邮箱地址',
    errLastSuper: '至少保留一个启用的超级管理员',
    errSelf: '不能停用或移除当前登录账号',
    gateDisabledLead: '该管理员账号已被停用，请联系超级管理员。',
    noPermTitle: '无该分区权限',
    noPermLead: '当前角色未开放此分区；如需调整，请联系超级管理员。',
    readOnlyNote: '当前角色对该分区只读',
    logAdminAdd: '新增管理员',
    logAdminStatus: '管理员启停',
    logAdminRemove: '移除管理员',
    frozenTitle: '一期固定参数',
    frozenLead: '以下参数当前为代码常量，随版本统一调整；开放可调后在此处登记留痕。',
    constRateCap: '抽成费率上限',
    constWithdrawMin: '单笔提现最低',
    constWithdrawFee: '提现手续费',
    constTopupMin: '单笔充值最低（卡 / 加密）',
    constRefundWindow: '退款窗口',
    constRefundCooling: '退款冷却期',
    lastRate: '上次调整',
    lastRateNone: '尚无调整记录',
    rateRangeLabel: '允许范围',
    specGroupFee: '抽成',
    specGroupCash: '充值与提现',
    specGroupRefund: '退款',
    audit: '操作记录',
    auditLead: '运营侧写操作留痕：结算推进、抽成调整、管理员账户。',
    colAction: '动作',
    colTarget: '对象',
    colChange: '变化',
    auditEmpty: '还没有操作记录；推进结算或调整抽成后此处出现。',
    logSettle: '结算推进',
    logStop: '实例强停',
    logRate: '抽成调整',
    colOperator: '操作人',
    confirmReject: '确认驳回？',
    confirmFail: '确认退回？',
    toastAdvance: (label: string) => `已推进到「${label}」`,
    toastRate: (pct: number) => `抽成已更新为 ${pct}%`,
    toastFail: '操作未生效；请刷新后重试',
  },
  en: {
    title: 'Admin console',
    gateTitle: 'Sign in with the operator account',
    gateLead: 'The console aggregates funds and instances across accounts; operator access only.',
    signIn: 'Enter as operator',
    noAccess: 'This account has no console access',
    noAccessLead: (email: string) => `The console is restricted to the operator account. Signed in as ${email}.`,
    switchAdmin: 'Switch to operator account',
    signOut: 'Sign out',
    skipToMain: 'Skip to main content',
    overview: 'Platform overview',
    balance: 'Tenant balances',
    settleable: 'Settleable total',
    held: 'Unfreezing',
    activeOrders: 'Active instances',
    inFlight: 'Exits in flight',
    platformIncome: 'Platform revenue',
    platformIncomeNote: 'fees + penalties, listed apart',
    secondaryGroup: 'Funds & leads',
    machinesNote: (host: number, listed: number) => `${host} registered · ${listed} listed`,
    spentTotal: 'Total spend',
    leadsCard: 'Enterprise leads',
    pendingSettle: 'Pending settlements',
    pendingSettleNote: (n: number) => `${n} awaiting review`,
    pendingSettleNone: 'None in review',
    colBook: 'Book',
    bookTenant: 'Tenant',
    bookHost: 'Host',
    detail: 'Details',
    detailClose: 'Close',
    pagePrev: 'Prev',
    pageNext: 'Next',
    pageInfo: (page: number, pages: number, total: number) => `Page ${page}/${pages} · ${total} rows`,
    filterTicket: 'Ticket No.',
    filterAccount: 'Account',
    filterAllKinds: 'All kinds',
    filterAllBooks: 'All books',
    filteredEmpty: 'No entries match the filters.',
    filterSearchOps: 'Search account, instance ID, or machine',
    filterAllStatus: 'All statuses',
    filterAllUses: 'All uses',
    filteredEmptyOps: 'No instances match the filters.',
    colConsumed: 'Consumed',
    colRefunded: 'Refunded',
    colWithdrawn: 'Withdrawn',
    colAvailable: 'Available',
    colDiff: 'Variance',
    colGross: 'Order amounts',
    colNet: 'Net',
    colFee: 'Fees',
    totalRow: 'Total',
    exportCsv: 'Export CSV',
    approvedNote: (v: string) => `includes ${v} approved and awaiting payout`,
    rate: 'Platform fee rate',
    rateLead: 'Applies at once to future earnings only; recorded entries stay unchanged.',
    rateInputLabel: 'Fee percentage',
    toastRateInvalid: (min: number, max: number) => `Enter a whole percentage from ${min} to ${max}`,
    colBasis: 'Approval basis',
    basisPool: 'Earnings pool',
    terminal: '— Terminal',
    settle: 'Settlement approvals',
    settleLead: 'Operators approve and start payouts; sent / paid / failed are driven by channel callbacks, never marked by hand.',
    colNo: 'No.',
    actApprove: 'Approve',
    actReject: 'Reject',
    actProcess: 'Start payout',
    waitingCallback: 'Awaiting channel callback…',
    waitingPaid: 'Awaiting settlement…',
    simulateFail: 'Simulate failure',
    toastProcessed: 'Submitted to channel; awaiting callback',
    operatorChannel: 'Channel callback',
    emptySettle: 'No settlement requests yet; submit one from the earnings page.',
    finance: 'Finance',
    financeLead: 'Funds at a glance: combined ledger and conservation checks.',
    users: 'Users',
    usersLead: 'Profiles for every account: role, joined, machines, and activity.',
    uDetail: 'Details',
    uClose: 'Close',
    machinesActive: 'active',
    colMachineLabel: 'Machine',
    colStartedAt: 'Started',
    colIdentity: 'Role',
    colJoined: 'Joined',
    colMachines: 'Machines',
    colActiveAt: 'Last active',
    roleTenant: 'Tenant',
    roleHost: 'Host',
    uFunds: 'Funds',
    uMachines: 'Machines',
    uRecent: 'Recent ledger',
    uViewAll: 'View full ledger',
    uNoMachines: 'No machine records',
    uTabTenant: 'Tenant',
    uTabHost: 'Host',
    uCollapse: 'Collapse',
    uExpandAll: (n: number) => `Show all ${n}`,
    uSettleable: 'Settleable',
    uSettleInFlight: 'Settling',
    uSettleRecords: 'Settlements',
    uNoSettle: 'No settlement records',
    colAt: 'Time',
    hostEarnTotal: 'Host earnings total',
    gmvNote: '= platform GMV',
    colBalance: 'Balance',
    colEarningTotal: 'Host earnings',
    viewLedger: 'View ledger',
    ledger: 'Ledger',
    ledgerLead: 'Recent entries across accounts; the balance column is the balance after that entry.',
    recon: 'Reconciliation',
    tenantRecon: 'Tenant-side conservation',
    tenantFormula: 'Σ payment lots = available + consumed + refunded + withdrawn',
    topup: 'Lot intake',
    allocated: 'Allocated total',
    hostRecon: 'Host-side conservation',
    hostFormula: 'Σ order amounts = Σ net + Σ platform fees',
    gross: 'Order amounts',
    netFee: 'Net + platform fees',
    reconDiff: 'Variance',
    reconDiffReview: 'needs review',
    reconCheckHint: 'Conservation mismatch — check per-account details',
    diffNote: 'Variance ≤ $0.01 counts as balanced (float tolerance).',
    escrowNote: (hold: string) => `Order prepayments of ${hold} are escrowed outside tenant balances (order SKU).`,
    ops: 'Instance operations',
    opsLead: 'Read-only: instances belong to hosts and tenants; the platform does not intervene in running instances.',
    colAccount: 'Account',
    colInstance: 'Instance',
    colStatus: 'Status',
    colSpent: 'Spent total',
    colAct: 'Action',
    emptyOps: 'No active instances.',
    colTime: 'Time',
    colUse: 'Declared use',
    colKind: 'Kind',
    colAmount: 'Amount',
    colBalAfter: 'Balance after',
    holdUntil: 'Unlocks at',
    colDesc: 'Description',
    emptyLedger: 'No entries yet.',
    leads: 'Enterprise leads',
    leadsLead: 'Submissions of the enterprise compute form (contact-sales).',
    colCompany: 'Company',
    colContact: 'Contact',
    colEmail: 'Email',
    colPurpose: 'Use case',
    colGpu: 'GPU / quantity',
    colReq: 'Requirements',
    emptyLeads: 'No leads yet; submit the enterprise form to see one here.',
    groupMonitor: 'Platform monitoring',
    groupFunds: 'Funds & approvals',
    groupOps: 'Operations & compliance',
    config: 'Configuration',
    roles: 'Admins & roles',
    rolesLead: 'The same matrix drives the console: navigation filters by role and write actions are guarded by it; the account roster is local demo state, maintained by the super admin.',
    roleSuper: 'Super admin',
    roleFinance: 'Finance ops',
    roleCompliance: 'Compliance review',
    roleViewer: 'Read-only observer',
    permRo: 'Read-only',
    permYesLabel: 'Write',
    permNoLabel: 'Hidden',
    roleNow: 'Active',
    roleSuperDesc: 'Full access, incl. admins & roles',
    roleFinanceDesc: 'Settlements, fee rate & ledger',
    roleComplianceDesc: 'Instances, leads & audit trail',
    roleViewerDesc: 'Read-only across the console',
    colSection: 'Section',
    colRole: 'Role',
    colAdded: 'Added',
    statusActive: 'Active',
    statusDisabled: 'Disabled',
    acctBuiltin: 'Built-in',
    acctTitle: 'Admin accounts',
    acctLead: 'The roster lives in this browser (demo state), maintained by the super admin; the same matrix drives this page, navigation and write guards across the console.',
    acctEmailPh: 'name@company.dev',
    acctSubmit: 'Add',
    acctDisable: 'Disable',
    acctEnable: 'Enable',
    acctRemove: 'Remove',
    confirmRemove: 'Confirm remove',
    toastAcctAdded: (email: string) => `Admin added: ${email}`,
    toastAcctRemoved: (email: string) => `${email} removed`,
    errAcctExists: 'Email already on the roster',
    errAcctInvalid: 'Enter a valid email address',
    errLastSuper: 'Keep at least one active super admin',
    errSelf: 'You cannot disable or remove your own account',
    gateDisabledLead: 'This admin account has been disabled; contact a super admin.',
    noPermTitle: 'No access to this section',
    noPermLead: 'Your role does not include this section; contact a super admin to adjust access.',
    readOnlyNote: 'Read-only for your role',
    logAdminAdd: 'Admin added',
    logAdminStatus: 'Admin status',
    logAdminRemove: 'Admin removed',
    frozenTitle: 'Fixed in phase 1',
    frozenLead: 'The parameters below are code constants this phase, adjusted per release; they move here with an audit trail once configurable.',
    constRateCap: 'Platform fee cap',
    constWithdrawMin: 'Min withdrawal',
    constWithdrawFee: 'Withdrawal fee',
    constTopupMin: 'Min top-up (card / crypto)',
    constRefundWindow: 'Refund window',
    constRefundCooling: 'Refund cooling period',
    lastRate: 'Last change',
    lastRateNone: 'No changes recorded yet',
    rateRangeLabel: 'Allowed range',
    specGroupFee: 'Platform fee',
    specGroupCash: 'Top-up & withdrawal',
    specGroupRefund: 'Refunds',
    audit: 'Audit log',
    auditLead: 'Operator write actions: settlement advances, rate changes, admin accounts.',
    colAction: 'Action',
    colTarget: 'Target',
    colChange: 'Change',
    auditEmpty: 'No entries yet; advance a settlement or change the rate.',
    logSettle: 'Settlement advance',
    logStop: 'Forced stop',
    logRate: 'Rate change',
    colOperator: 'Operator',
    confirmReject: 'Confirm reject?',
    confirmFail: 'Confirm return?',
    toastAdvance: (label: string) => `Advanced to "${label}"`,
    toastRate: (pct: number) => `Rate updated to ${pct}%`,
    toastFail: 'Action did not apply; refresh and retry',
  },
}

/* 独立入口（admin.html）：闸 + 后台壳；lang 状态由 main-admin.tsx 提供 */
export default function AdminApp({ lang, onToggleLang }: {
  lang: Language
  onToggleLang: () => void
}) {
  const t = copy[lang]
  const { account, signIn, signOut } = useSession()
  /* 数据 hook 在闸前挂：聚合是只读遍历，无泄露面；闸只挡渲染。
     闸按管理员名单放行（演示态名单，见 adminStore）；登录 stub 不变，名单外一律无权限态 */
  const { buckets, leads, logs, admins } = useAdminData()
  const gateAcct = account ? loadAdmins().find(a => a.email === account.email.trim().toLowerCase()) : undefined
  if (!account || !gateAcct || gateAcct.status === 'disabled') {
    return <div className={s.gatePage}>
      <div className={s.gateCard}>
        <div className={s.gateBrand}><span>Mekong</span>{t.title}</div>
        <div className={s.gate}>
          <h2>{account ? t.noAccess : t.gateTitle}</h2>
          <p>{!account ? t.gateLead : !gateAcct ? t.noAccessLead(account.email) : t.gateDisabledLead}</p>
          <button className={u.btnPrimary} onClick={() => signIn(ADMIN_EMAIL)}>{account ? t.switchAdmin : t.signIn}</button>
        </div>
      </div>
    </div>
  }
  return <AdminConsole key={account.email} lang={lang} buckets={buckets} leads={leads} logs={logs} admins={admins}
    operator={account.email} onSignOut={signOut} onToggleLang={onToggleLang} />
}

type SectionKey = 'overview' | 'ledger' | 'users' | 'settle' | 'rate' | 'ops' | 'leads' | 'roles' | 'audit'
type Toast = { id: number; text: string; tone: 'ok' | 'bad' }

const NAV_GROUPS: { label: (t: Copy) => string; items: { key: SectionKey; label: (t: Copy) => string }[] }[] = [
  {
    label: t => t.groupMonitor,
    items: [
      { key: 'overview', label: t => t.overview },
      { key: 'ledger', label: t => t.finance },
      { key: 'users', label: t => t.users },
    ],
  },
  {
    label: t => t.groupFunds,
    items: [
      { key: 'settle', label: t => t.settle },
      { key: 'rate', label: t => t.config },
    ],
  },
  {
    label: t => t.groupOps,
    items: [
      { key: 'ops', label: t => t.ops },
      { key: 'leads', label: t => t.leads },
      { key: 'roles', label: t => t.roles },
      { key: 'audit', label: t => t.audit },
    ],
  },
]

const SECTION_KEYS = new Set(NAV_GROUPS.flatMap(g => g.items.map(i => i.key)))
/* 分区名单一信源：矩阵行/无权限页与导航共用（copy 键与分区键在 ledger/rate 两处不同名） */
const SECTION_LABEL: Record<SectionKey, (t: Copy) => string> = {
  overview: t => t.overview,
  ledger: t => t.finance,
  users: t => t.users,
  settle: t => t.settle,
  rate: t => t.config,
  ops: t => t.ops,
  leads: t => t.leads,
  roles: t => t.roles,
  audit: t => t.audit,
}
/* 旧直链迁移：对账并入账务、end-use 并入实例运维——重定向到新 hash，不回落大盘 */
const HASH_ALIAS: Record<string, SectionKey> = { recon: 'ledger', enduse: 'ops' }
const sectionFromHash = (): SectionKey => {
  const key = window.location.hash.replace(/^#/, '')
  const migrated = HASH_ALIAS[key]
  if (migrated) {
    history.replaceState(null, '', `#${migrated}`)
    return migrated
  }
  return SECTION_KEYS.has(key as SectionKey) ? key as SectionKey : 'overview'
}

function AdminConsole({ lang, buckets, leads, logs, admins, operator, onSignOut, onToggleLang }: {
  lang: Language
  buckets: AccountBucket[]
  leads: Lead[]
  logs: AdminLog[]
  admins: AdminAccount[]
  operator: string
  onSignOut: () => void
  onToggleLang: () => void
}) {
  const t = copy[lang]
  const [section, setSection] = useState<SectionKey>(sectionFromHash)
  /* 分区直链：点击用 replaceState（不堆历史），外部 hash 变化（手改 URL/前进后退）同步高亮 */
  useEffect(() => {
    const sync = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const nav = (key: SectionKey) => {
    setSection(key)
    if (window.location.hash !== `#${key}`) history.replaceState(null, '', `#${key}`)
  }
  /* 模拟渠道异步回调（演示口径）：出款中 → 已出款 → 到账，各约 2 秒自动推进。
     放在常驻壳层而非面板内，切分区/离开结算页也不会停；接真实渠道时把这里换成回调监听。
     记录每单首次观测时刻（Map），避免每次轮询重置计时；终态即清理 */
  const cbSeen = useRef<Map<string, number>>(new Map())
  /* 轮询器自身的 1s 刷新会让 effect 依赖变化而重建 interval（永远等不到 2s 判定），
     故 effect 只挂一次，用 ref 读最新桶 */
  const bucketsRef = useRef(buckets)
  bucketsRef.current = buckets
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now()
      for (const b of bucketsRef.current) {
        for (const r of b.wallet.settleReqs) {
          const key = `${b.email}:${r.id}`
          if (r.status !== 'processing' && r.status !== 'sent') { cbSeen.current.delete(key); continue }
          const seen = cbSeen.current.get(key)
          if (seen === undefined) { cbSeen.current.set(key, at); continue }
          if (at - seen >= 2000) {
            adminSettleAdvance(b.email, r.id, r.status === 'processing' ? 'sent' : 'paid', 'channel')
            cbSeen.current.delete(key)
          }
        }
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)
  const pushToast = (text: string, tone: 'ok' | 'bad') => {
    const id = ++toastSeq.current
    setToasts(current => [...current, { id, text, tone }])
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 2600)
  }
  const derived = useMemo(() => derive(buckets), [buckets])
  const opsStats = useMemo(() => deriveOps(buckets, leads.length), [buckets, leads])
  const reconRows = useMemo(() => deriveReconAccounts(buckets), [buckets])
  const instances = useMemo(() => collectActiveInstances(buckets), [buckets])
  /* 用户管理 → 账务跳转：预填账号筛选（主体视角落到流水视角的接续点） */
  const [flyAccount, setFlyAccount] = useState('')
  const ledger = useMemo(() => mergeLedger(buckets), [buckets])
  const current = NAV_GROUPS.flatMap(g => g.items).find(item => item.key === section)!
  const mainRef = useRef<HTMLElement>(null)
  /* 在册角色解析（展示与执行同一信源：PERM_BY_ROLE ← 权限矩阵）。
     名单变化经 useAdminData 轮询跟上——本账号被停用/移除（如超管在另一 tab 操作）即时落到无权限态 */
  const me = admins.find(a => a.email === operator.trim().toLowerCase())
  const role = me?.role ?? 'viewer'
  const visibleGroups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => canSee(role, i.key)) }))
    .filter(g => g.items.length > 0)
  if (!me || me.status !== 'active') {
    return <div className={s.gatePage}>
      <div className={s.gateCard}>
        <div className={s.gateBrand}><span>Mekong</span>{t.title}</div>
        <div className={s.gate}>
          <h2>{t.noAccess}</h2>
          <p>{me ? t.gateDisabledLead : t.noAccessLead(operator)}</p>
          <button className={u.btnPrimary} onClick={onSignOut}>{t.signOut}</button>
        </div>
      </div>
    </div>
  }
  return <div className={s.admin}>
    <button type="button" className={s.skipLink} onClick={() => mainRef.current?.focus()}>{t.skipToMain}</button>
    <aside className={s.adminSide}>
      <div className={s.adminBrand}><span>Mekong</span>{t.title}</div>
      <nav className={s.adminNav} aria-label={t.title}>
        {visibleGroups.map(group => <div key={group.label(t)} className={s.adminGroup}>
          <span className={s.adminGroupLabel} aria-hidden="true">{group.label(t)}</span>
          {group.items.map(item => <button key={item.key} type="button" className={s.adminNavBtn}
            data-active={item.key === section || undefined}
            aria-current={item.key === section ? 'page' : undefined}
            onClick={() => nav(item.key)}>{item.label(t)}</button>)}
        </div>)}
      </nav>
      <div className={s.adminSideFoot}>
        <span className={s.adminRoleTag}>{ROLE_COLS.find(c => c.key === role)?.label(t) ?? role}</span>
        <span className={s.adminEmail} title={operator}>{operator}</span>
        <button type="button" className={s.adminSignOut} onClick={onSignOut}>{t.signOut}</button>
      </div>
    </aside>
    <div className={s.adminBody}>
      <header className={s.adminTop}>
        <h1>{current.label(t)}</h1>
        <button type="button" className={s.adminLang} onClick={onToggleLang}
          aria-label={lang === 'zh' ? 'Switch to English' : '切换为中文'}>{lang === 'zh' ? 'EN' : '中文'}</button>
      </header>
      <main ref={mainRef} tabIndex={-1} className={s.adminMain}>
        {!canSee(role, section) ? <section className={s.section} aria-label={t.noPermTitle}>
            <div className={s.gate}><h2>{t.noPermTitle}</h2><p>{t.noPermLead}</p></div>
          </section>
          : <>
        {section === 'overview' && <OverviewCards t={t} d={derived} ops={opsStats} onOpenSettle={canSee(role, 'settle') ? () => nav('settle') : undefined} />}
        {section === 'ledger' && <FinancePanel t={t} lang={lang} d={derived} rows={ledger} recon={reconRows} initialAccountQ={flyAccount} />}
        {section === 'users' && <UsersPanel t={t} lang={lang} buckets={buckets} onViewLedger={email => { setFlyAccount(email); nav('ledger') }} />}
        {section === 'rate' && <RatePanel t={t} lang={lang} logs={logs} onToast={pushToast} />}
        {section === 'settle' && <SettlePanel t={t} lang={lang} buckets={buckets} writable={canWrite(role, 'settle')} onToast={pushToast} />}
        {section === 'ops' && <OpsPanel t={t} lang={lang} instances={instances} />}
        {section === 'leads' && <LeadsPanel t={t} rows={leads} />}
        {section === 'roles' && <RolesPanel t={t} admins={admins} operator={operator} onToast={pushToast} />}
        {section === 'audit' && <AuditPanel t={t} lang={lang} rows={logs} />}
          </>}
      </main>
    </div>
    <div className={s.toastStack} role="status" aria-live="polite">
      {toasts.map(item => <div key={item.id} className={s.toast} data-tone={item.tone}>{item.text}</div>)}
    </div>
  </div>
}

type Copy = typeof copy.zh

/* 大盘：主次两层——主行 4 张大卡回答运营者三问（平台赚多少 / 生意多大 / 有什么要我办），
   待审结算卡可点击直跳审批；次行 6 张小卡降权承载资金细节与线索。
   弱信号卡已删：累计租用时长（GMV 冗余）、累计提现（易误读为成本）、账号数（明细在用户管理） */
function OverviewCards({ t, d, ops, onOpenSettle }: { t: Copy; d: AdminDerived; ops: AdminOpsStats; onOpenSettle?: () => void }) {
  const primary: Array<{ label: string; value: string; note?: string; tone: 'ok' | 'warn' | 'info'; onClick?: () => void }> = [
    { label: t.platformIncome, value: money(d.feeTotal + d.penaltyTotal), note: `${money(d.feeTotal)} + ${money(d.penaltyTotal)}`, tone: 'ok' as const },
    { label: t.spentTotal, value: money(ops.spentTotal), note: t.gmvNote, tone: 'ok' as const },
    { label: t.pendingSettle, value: money(ops.pendingSettleAmount), note: ops.pendingSettles > 0 ? t.pendingSettleNote(ops.pendingSettles) : t.pendingSettleNone, tone: ops.pendingSettles > 0 ? 'warn' as const : 'ok' as const, onClick: onOpenSettle },
    { label: t.activeOrders, value: String(d.activeOrders), note: t.machinesNote(ops.hostRegistered, ops.listed), tone: 'info' as const },
  ]
  const secondary = [
    { label: t.balance, value: money(d.balanceTotal), tone: 'info' as const },
    { label: t.settleable, value: money(d.settleableTotal), tone: 'ok' as const },
    { label: t.held, value: money(d.heldTotal), note: d.approvedFrozen > 0.005 ? t.approvedNote(money(d.approvedFrozen)) : undefined, tone: 'info' as const },
    { label: t.inFlight, value: money(d.exitsInFlight), tone: 'warn' as const },
    { label: t.hostEarnTotal, value: money(d.earnNet), note: `${money(d.earnGross)} gross`, tone: 'ok' as const },
    { label: t.leadsCard, value: String(ops.leads), tone: 'info' as const },
  ]
  return <section className={s.section} aria-label={t.overview}>
    <div className={s.sectionHead}><h2 className={s.srOnly}>{t.overview}</h2><span className={s.sectionNote}>{t.platformIncomeNote}</span></div>
    <div className={s.cardsPrimary}>
      {primary.map(card => card.onClick
        ? <button type="button" key={card.label} className={`${s.card} ${s.cardAction}`} data-tone={card.tone} onClick={card.onClick}>
          <span className={s.cardLabel}>{card.label}</span>
          <strong className={`${s.cardValue} ${u.mono}`}>{card.value}</strong>
          {card.note && <span className={`${s.cardNote} ${u.mono}`}>{card.note}</span>}
        </button>
        : <article key={card.label} className={s.card} data-tone={card.tone}>
          <span className={s.cardLabel}>{card.label}</span>
          <strong className={`${s.cardValue} ${u.mono}`}>{card.value}</strong>
          {card.note && <span className={`${s.cardNote} ${u.mono}`}>{card.note}</span>}
        </article>)}
    </div>
    <p className={s.cardGroupLabel}>{t.secondaryGroup}</p>
    <div className={s.cards}>
      {secondary.map(card => <article key={card.label} className={s.card} data-tone={card.tone}>
        <span className={s.cardLabel}>{card.label}</span>
        <strong className={`${s.cardValue} ${u.mono}`}>{card.value}</strong>
        {card.note && <span className={`${s.cardNote} ${u.mono}`}>{card.note}</span>}
      </article>)}
    </div>
  </section>
}

/* 账务页：顶部守恒状态条（双边闭合徽章）+ 流水/对账明细双视图；旧 #recon 直链迁移至此 */
function FinancePanel({ t, lang, d, rows, recon, initialAccountQ }: { t: Copy; lang: Language; d: AdminDerived; rows: MergedLedger[]; recon: ReconAccountRow[]; initialAccountQ: string }) {
  const [view, setView] = useState<'ledger' | 'recon'>('ledger')
  return <section className={s.section} aria-labelledby="admin-finance-title">
    <div className={s.sectionHead}><h2 id="admin-finance-title" className={s.srOnly}>{t.finance}</h2><span className={s.sectionNote}>{t.financeLead}</span></div>
    {(Math.abs(d.tenantReconDiff) > 0.01 || Math.abs(d.hostReconDiff) > 0.01) && <div className={s.diffAlert} role="alert">
      <span>{t.reconCheckHint}</span>
      <button type="button" className={u.btnGhost} onClick={() => setView('recon')}>{t.recon}</button>
    </div>}
    <div className={s.viewBar}>
    <div className={s.seg} role="group" aria-label={t.finance}>
      <button type="button" className={s.segBtn} aria-pressed={view === 'ledger' || undefined} onClick={() => setView('ledger')}>{t.ledger}</button>
      <button type="button" className={s.segBtn} aria-pressed={view === 'recon' || undefined} onClick={() => setView('recon')}>{t.recon}</button>
    </div>
    <div className={s.financeBar}>
      <span className={s.financeItem}><span>{t.tenantRecon}</span>{diffBadge(t, d.tenantReconDiff)}</span>
      <span className={s.financeItem}><span>{t.hostRecon}</span>{diffBadge(t, d.hostReconDiff)}</span>
    </div>
    </div>
    {view === 'ledger' ? <LedgerView t={t} lang={lang} rows={rows} initialAccountQ={initialAccountQ} /> : <ReconView t={t} d={d} recon={recon} />}
  </section>
}

/* 差异 ≤ $0.01 视为闭合（浮点容差）；徽章带差异金额，异常一眼可读 */
function diffBadge(t: Copy, diff: number) {
  const ok = Math.abs(diff) <= 0.01
  return ok
    ? <Badge tone="ok">{t.reconDiff} {money(diff)}</Badge>
    : <Badge tone="bad">{t.reconDiff} {money(diff)} · {t.reconDiffReview}</Badge>
}

/* 对账明细：逐账号双侧守恒表 + 合计行 + CSV 导出（校验从「看总数」变成「可核对可带走」） */
function ReconView({ t, d, recon }: { t: Copy; d: AdminDerived; recon: ReconAccountRow[] }) {
  const tenants = recon.filter(r => r.tenant)
  const hosts = recon.filter(r => r.host)
  const sum = (vals: number[]) => +vals.reduce((a, b) => a + b, 0).toFixed(2)
  const tenantTotal = {
    topup: sum(tenants.map(r => r.tenant!.topup)),
    consumed: sum(tenants.map(r => r.tenant!.consumed)),
    refunded: sum(tenants.map(r => r.tenant!.refunded)),
    withdrawn: sum(tenants.map(r => r.tenant!.withdrawn)),
    available: sum(tenants.map(r => r.tenant!.available)),
    diff: sum(tenants.map(r => r.tenant!.diff)),
  }
  const hostTotal = {
    gross: sum(hosts.map(r => r.host!.gross)),
    net: sum(hosts.map(r => r.host!.net)),
    fee: sum(hosts.map(r => r.host!.fee)),
    diff: sum(hosts.map(r => r.host!.diff)),
  }
  const csv = (name: string, head: string[], body: (string | number)[][]) => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const text = [head, ...body].map(line => line.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }
  return <>
    <p className={s.viewNote}>{t.diffNote}</p>
    <div className={s.reconBlock}>
      <div className={s.reconBlockHead}>
        <h3>{t.tenantRecon}</h3>
        <span className={s.reconFormula}>{t.tenantFormula}</span>
        <button type="button" className={u.btnGhost} onClick={() => csv(`recon-tenant.csv`,
          [t.colAccount, t.topup, t.colConsumed, t.colRefunded, t.colWithdrawn, t.colAvailable, t.colDiff],
          [...tenants.map(r => [r.email, r.tenant!.topup, r.tenant!.consumed, r.tenant!.refunded, r.tenant!.withdrawn, r.tenant!.available, r.tenant!.diff]),
          [t.totalRow, tenantTotal.topup, tenantTotal.consumed, tenantTotal.refunded, tenantTotal.withdrawn, tenantTotal.available, tenantTotal.diff]])}>{t.exportCsv}</button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>{t.colAccount}</th><th className={s.right}>{t.topup}</th><th className={s.right}>{t.colConsumed}</th><th className={s.right}>{t.colRefunded}</th><th className={s.right}>{t.colWithdrawn}</th><th className={s.right}>{t.colAvailable}</th><th className={s.right}>{t.colDiff}</th></tr></thead>
          <tbody>
            {tenants.map(r => <tr key={r.email}>
              <td className={u.mono}>{r.email}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.tenant!.topup)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.tenant!.consumed)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.tenant!.refunded)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.tenant!.withdrawn)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.tenant!.available)}</td>
              <td className={`${s.right} ${u.mono}`}>{diffText(r.tenant!.diff)}</td>
            </tr>)}
          </tbody>
          <tfoot><tr>
            <td>{t.totalRow}</td>
            <td className={`${s.right} ${u.mono}`}>{money(tenantTotal.topup)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(tenantTotal.consumed)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(tenantTotal.refunded)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(tenantTotal.withdrawn)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(tenantTotal.available)}</td>
            <td className={`${s.right} ${u.mono}`}>{diffText(tenantTotal.diff)}</td>
          </tr></tfoot>
        </table>
      </div>
      {d.escrowHoldTotal > 0.005 && <p className={s.reconNote}>{t.escrowNote(money(d.escrowHoldTotal))}</p>}
    </div>
    <div className={s.reconBlock}>
      <div className={s.reconBlockHead}>
        <h3>{t.hostRecon}</h3>
        <span className={s.reconFormula}>{t.hostFormula}</span>
        <button type="button" className={u.btnGhost} onClick={() => csv(`recon-host.csv`,
          [t.colAccount, t.gross, t.colNet, t.colFee, t.colDiff],
          [...hosts.map(r => [r.email, r.host!.gross, r.host!.net, r.host!.fee, r.host!.diff]),
          [t.totalRow, hostTotal.gross, hostTotal.net, hostTotal.fee, hostTotal.diff]])}>{t.exportCsv}</button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>{t.colAccount}</th><th className={s.right}>{t.gross}</th><th className={s.right}>{t.colNet}</th><th className={s.right}>{t.colFee}</th><th className={s.right}>{t.colDiff}</th></tr></thead>
          <tbody>
            {hosts.map(r => <tr key={r.email}>
              <td className={u.mono}>{r.email}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.host!.gross)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.host!.net)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(r.host!.fee)}</td>
              <td className={`${s.right} ${u.mono}`}>{diffText(r.host!.diff)}</td>
            </tr>)}
          </tbody>
          <tfoot><tr>
            <td>{t.totalRow}</td>
            <td className={`${s.right} ${u.mono}`}>{money(hostTotal.gross)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(hostTotal.net)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(hostTotal.fee)}</td>
            <td className={`${s.right} ${u.mono}`}>{diffText(hostTotal.diff)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </>
}

function diffText(diff: number) {
  return Math.abs(diff) <= 0.01
    ? <Badge tone="ok">{money(diff)}</Badge>
    : <Badge tone="bad">{money(diff)}</Badge>
}

const LEDGER_PAGE = 12

/* 流水：租客/宿主双账本按单号统看；主表精简（余额后等字段入行内详情），每页 20 */
function LedgerView({ t, lang, rows, initialAccountQ }: { t: Copy; lang: Language; rows: MergedLedger[]; initialAccountQ: string }) {
  const kinds = ADMIN_KIND_LABEL[lang]
  const [page, setPage] = useState(1)
  const [openRow, setOpenRow] = useState<MergedLedger | null>(null)
  const [ticketQ, setTicketQ] = useState('')
  const [accountQ, setAccountQ] = useState(initialAccountQ)
  const [kind, setKind] = useState<'all' | LedgerKind>('all')
  const [book, setBook] = useState<'all' | 'tenant' | 'host'>('all')
  /* 筛选后分页回到第 1 页：否则筛到只剩 1 页时页码会悬空 */
  const resetPage = <T,>(set: (v: T) => void) => (value: T) => { set(value); setPage(1) }
  const tq = ticketQ.trim().toLowerCase()
  const aq = accountQ.trim().toLowerCase()
  const filtered = rows.filter(row =>
    (kind === 'all' || row.kind === kind) &&
    (book === 'all' || row.book === book) &&
    (!tq || row.id.toLowerCase().includes(tq)) &&
    (!aq || row.email.toLowerCase().includes(aq)))
  const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE))
  const current = Math.min(page, pages)
  const slice = filtered.slice((current - 1) * LEDGER_PAGE, current * LEDGER_PAGE)
  const noteOf = (row: MergedLedger) =>
    row.label || (row.channel === 'crypto' ? 'USDT' : row.channel === 'card' ? (lang === 'zh' ? '银行卡' : 'Card') : '—')
  /* 抽屉：✕ / 遮罩 / Esc 三条关闭路径 + 焦点管理——打开移焦首个控件、Tab 在抽屉内环绕、
     关闭（含 Esc/遮罩）还原到触发按钮（键盘用户不困在浮层，也不丢位置） */
  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!openRow) return
    const node = drawerRef.current
    const opener = document.activeElement as HTMLElement | null
    const focusables = () => node
      ? Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea'))
      : []
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenRow(null); return }
      if (e.key !== 'Tab' || !node) return
      const list = focusables()
      if (list.length === 0) return
      if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === list[list.length - 1]) { e.preventDefault(); list[0].focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); opener?.focus() }
  }, [openRow])
  return <>
    <p className={s.viewNote}>{t.ledgerLead}</p>
    {rows.length === 0 ? <p className={s.empty}>{t.emptyLedger}</p> : <>
      <div className={s.ledgerFilters}>
        <input type="search" value={ticketQ} placeholder={t.filterTicket} aria-label={t.filterTicket}
          className={s.filterInput} onChange={e => resetPage(setTicketQ)(e.target.value)} />
        <input type="search" value={accountQ} placeholder={t.filterAccount} aria-label={t.filterAccount}
          className={s.filterInput} onChange={e => resetPage(setAccountQ)(e.target.value)} />
        <select value={kind} aria-label={t.colKind} className={s.filterSelect}
          onChange={e => resetPage(setKind)(e.target.value as 'all' | LedgerKind)}>
          <option value="all">{t.filterAllKinds}</option>
          {(['topup', 'consume', 'refund', 'withdraw', 'earning', 'penalty'] as LedgerKind[]).map(k => <option key={k} value={k}>{kinds[k]}</option>)}
        </select>
        <select value={book} aria-label={t.colBook} className={s.filterSelect}
          onChange={e => resetPage(setBook)(e.target.value as 'all' | 'tenant' | 'host')}>
          <option value="all">{t.filterAllBooks}</option>
          <option value="tenant">{t.bookTenant}</option>
          <option value="host">{t.bookHost}</option>
        </select>
      </div>
      {filtered.length === 0 ? <p className={s.empty}>{t.filteredEmpty}</p> : <>
      <div className={s.tableWrap}>
        <table className={`${s.table} ${s.dense}`}>
          <thead><tr><th>{t.colNo}</th><th>{t.colTime}</th><th>{t.colAccount}</th><th>{t.colBook}</th><th>{t.colKind}</th><th className={s.right}>{t.colAmount}</th><th className={s.right}>{t.detail}</th></tr></thead>
          <tbody>
            {slice.map(row => <tr key={`${row.book}:${row.email}:${row.id}`}>
              <td className={`${u.mono} ${s.ticketCell}`}>{row.id}</td>
              <td className={u.mono}>{stampFull(row.at)}</td>
              <td className={u.mono}>{row.email}</td>
              <td><Badge tone={row.book === 'host' ? 'ok' : 'info'}>{row.book === 'host' ? t.bookHost : t.bookTenant}</Badge></td>
              <td><Badge tone={row.kind === 'penalty' ? 'bad' : row.kind === 'topup' || row.kind === 'earning' || row.into ? 'ok' : 'info'}>{kinds[row.kind]}</Badge></td>
              <td className={`${s.right} ${u.mono}`}>{row.into ? '+' : ''}{money(row.amount)}</td>
              <td className={s.right}>
                <button type="button" className={s.linkBtn} onClick={() => setOpenRow(row)}>{t.detail}</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className={s.pager}>
        <span className={u.mono}>{t.pageInfo(current, pages, filtered.length)}</span>
        <div className={s.pagerBtns}>
          <button type="button" className={u.btnGhost} disabled={current <= 1} onClick={() => setPage(current - 1)}>{t.pagePrev}</button>
          <button type="button" className={u.btnGhost} disabled={current >= pages} onClick={() => setPage(current + 1)}>{t.pageNext}</button>
        </div>
      </div>
      </>}
    </>}
    {openRow && <>
      <div className={s.drawerMask} onClick={() => setOpenRow(null)} aria-hidden="true" />
      <aside ref={drawerRef} className={s.drawer} role="dialog" aria-modal="true" aria-label={t.detail}>
        <div className={s.drawerHead}>
          <h3>{t.detail}</h3>
          <button type="button" className={s.drawerClose} aria-label={t.detailClose} onClick={() => setOpenRow(null)}>✕</button>
        </div>
        <dl className={s.drawerGrid}>
          <div><dt>{t.colNo}</dt><dd className={u.mono}>{openRow.id}</dd></div>
          <div><dt>{t.colAccount}</dt><dd className={u.mono}>{openRow.email}</dd></div>
          <div><dt>{t.colBook}</dt><dd className={u.mono}>{openRow.book === 'host' ? t.bookHost : t.bookTenant}</dd></div>
          <div><dt>{t.colKind}</dt><dd className={u.mono}>{kinds[openRow.kind]}</dd></div>
          <div><dt>{t.colAmount}</dt><dd className={u.mono}>{openRow.into ? '+' : ''}{money(openRow.amount)}</dd></div>
          <div><dt>{t.colTime}</dt><dd className={u.mono}>{stampFull(openRow.at)}</dd></div>
          <div><dt>{t.colBalAfter}</dt><dd className={u.mono}>{openRow.balAfter === undefined ? '—' : money(openRow.balAfter)}</dd></div>
          <div><dt>{t.colDesc}</dt><dd className={u.mono}>{noteOf(openRow)}</dd></div>
          {openRow.holdUntil !== undefined && <div><dt>{t.holdUntil}</dt><dd className={u.mono}>{stampFull(openRow.holdUntil)}</dd></div>}
        </dl>
      </aside>
    </>}
  </>
}

/* 抽成：数字输入失焦/回车提交，留痕与 toast 同时机；空串/非整数/越界回退并就地提示
   （空串 Number('')===0 会借 RATE_MIN=0 通过校验，不挡则把抽成静默改成 0%），错误关联控件 */
function RatePanel({ t, lang, logs, onToast }: { t: Copy; lang: Language; logs: AdminLog[]; onToast: (text: string, tone: 'ok' | 'bad') => void }) {
  const [rate, setRate] = useState(readRate)
  const pct = Math.round(rate * 100)
  const [draft, setDraft] = useState(String(pct))
  const [invalid, setInvalid] = useState(false)
  const lo = Math.round(RATE_MIN * 100)
  const hi = Math.round(RATE_MAX * 100)
  useEffect(() => setDraft(String(pct)), [pct])
  /* 上次调整取持久留痕（mk-site-adminlog，头部最新）——与操作记录页同源 */
  const lastRate = useMemo(() => logs.find(row => row.action === 'rate.update'), [logs])
  /* 留痕只在提交时刻写一次（失焦/回车），与 toast 同时机 */
  const logged = useRef(pct)
  const logRate = (next: number) => {
    if (next === logged.current) return
    pushAdminLog({ action: 'rate.update', target: 'rate', detail: `${logged.current}% → ${next}%` })
    logged.current = next
  }
  const commit = () => {
    const text = draft.trim()
    const n = Number(text)
    if (text === '' || !Number.isInteger(n) || n < lo || n > hi) {
      setDraft(String(pct))
      setInvalid(true)
      onToast(t.toastRateInvalid(lo, hi), 'bad')
      return
    }
    setInvalid(false)
    if (n === pct) return
    const next = n / 100
    setRate(next)
    writeRate(next)
    logRate(n)
    onToast(t.toastRate(n), 'ok')
  }
  return <section className={s.section} aria-labelledby="admin-rate-title">
    <div className={s.sectionHead}><h2 id="admin-rate-title" className={s.srOnly}>{t.rate}</h2><span className={s.sectionNote}>{t.rateLead}</span></div>
    <div className={s.rateCard}>
      <div className={s.rateMain}>
        <div className={s.rateInfo}>
          <span className={s.rateName}>{t.rate}</span>
          <span className={s.rateDesc}>{lang === 'zh' ? '新收益按此费率扣平台费用' : 'New earnings accrue at this rate'}</span>
        </div>
        <div className={s.rateControl}>
          <label className={s.rateField}>
            <input type="number" inputMode="numeric" min={RATE_MIN * 100} max={RATE_MAX * 100} step={1}
              value={draft} aria-label={t.rateInputLabel} className={`${s.rateInput} ${u.mono}`}
              aria-invalid={invalid || undefined} aria-describedby={invalid ? 'admin-rate-err' : undefined}
              onChange={e => { setDraft(e.target.value); setInvalid(false) }}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
            <span className={s.rateUnit}>%</span>
          </label>
          <span className={s.rateRange}>{t.rateRangeLabel} <span className={u.mono}>{lo}–{hi}%</span></span>
          {invalid && <span id="admin-rate-err" role="alert" className={s.rateErr}>{t.toastRateInvalid(lo, hi)}</span>}
        </div>
      </div>
      <div className={s.rateLast}>
        <span>{t.lastRate}</span>
        {lastRate
          ? <><span className={u.mono}>{lastRate.detail}</span><span aria-hidden="true">·</span><span className={u.mono}>{stampFull(lastRate.at)}</span></>
          : <span>{t.lastRateNone}</span>}
      </div>
    </div>
    {/* 一期其余资金参数为代码常量（与对客端同一信源 wallet/store），按业务域分组只读展示；
        值随常量走，不另设旁路数字——升为可配置时移回上方输入卡并走 pushAdminLog 留痕 */}
    <h3 className={s.blockHead}>{t.frozenTitle}</h3>
    <p className={s.blockLead}>{t.frozenLead}</p>
    <div className={s.specCard}>
      <h4 className={s.specGroupLabel}>{t.specGroupFee}</h4>
      <dl className={s.specList}>
        <div className={s.specRow}><dt className={s.specName}>{t.constRateCap}</dt><dd className={`${s.specVal} ${u.mono}`}>{Math.round(RATE_MAX * 100)}%</dd></div>
      </dl>
      <h4 className={s.specGroupLabel}>{t.specGroupCash}</h4>
      <dl className={s.specList}>
        <div className={s.specRow}><dt className={s.specName}>{t.constWithdrawFee}</dt><dd className={`${s.specVal} ${u.mono}`}>{lang === 'zh' ? `${Math.round(WITHDRAW_FEE_RATE * 100)}%（最低 ${money(WITHDRAW_FEE_MIN)}）` : `${Math.round(WITHDRAW_FEE_RATE * 100)}% (min ${money(WITHDRAW_FEE_MIN)})`}</dd></div>
        <div className={s.specRow}><dt className={s.specName}>{t.constWithdrawMin}</dt><dd className={`${s.specVal} ${u.mono}`}>{money(MIN_WITHDRAW)}</dd></div>
        <div className={s.specRow}><dt className={s.specName}>{t.constTopupMin}</dt><dd className={`${s.specVal} ${u.mono}`}>{money(MIN_TOPUP.card)} / {money(MIN_TOPUP.crypto)}</dd></div>
      </dl>
      <h4 className={s.specGroupLabel}>{t.specGroupRefund}</h4>
      <dl className={s.specList}>
        <div className={s.specRow}><dt className={s.specName}>{t.constRefundWindow}</dt><dd className={`${s.specVal} ${u.mono}`}>{lang === 'zh' ? `${REFUND_WINDOW_DAYS} 天` : `${REFUND_WINDOW_DAYS} days`}</dd></div>
        <div className={s.specRow}><dt className={s.specName}>{t.constRefundCooling}</dt><dd className={`${s.specVal} ${u.mono}`}>{lang === 'zh' ? `${REFUND_COOLING_DAYS} 天` : `${REFUND_COOLING_DAYS} days`}</dd></div>
      </dl>
    </div>
  </section>
}

/* 结算审批台：按当前态出动作（pending→批准/驳回、approved→发起出款、processing→标记已出款、sent→到账/失败）
   驳回与失败退回带行内武装确认（3s 复位，与强停同型）——终死单与改账本的动作不容误触 */
function SettlePanel({ t, lang, buckets, writable, onToast }: { t: Copy; lang: Language; buckets: AccountBucket[]; writable: boolean; onToast: (text: string, tone: 'ok' | 'bad') => void }) {
  const rows = useMemo(() => collectSettleReqs(buckets), [buckets])
  /* 审批依据：该账号当前收益池余额（结算的可用来源，账号级事实） */
  const pools = useMemo(() => new Map(buckets.map(b => [b.email, b.wallet.earnings])), [buckets])
  const [armKey, setArmKey] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const arm = (key: string) => {
    setArmKey(key)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setArmKey(current => current === key ? null : current), 3000)
  }
  const advance = (email: string, req: SettleRequest, to: SettleStatus) => {
    window.clearTimeout(timer.current)
    setArmKey(null)
    if (!adminSettleAdvance(email, req.id, to)) { onToast(t.toastFail, 'bad'); return }
    onToast(to === 'processing' ? t.toastProcessed : t.toastAdvance(ADMIN_SETTLE_LABEL[to][lang]), 'ok')
  }
  const actions = (row: SettleRow) => {
    /* 角色只读（矩阵 canWrite=false）：动作整体不渲染，操作列留「只读」——
       与导航过滤同一矩阵驱动，杜绝只藏按钮不拦执行的假拦截 */
    if (!writable) return [<span key="ro" className={s.waiting}>{t.permRo}</span>]
    const { email, req } = row
    const key = `${email}:${req.id}:${row.req.status}`
    const btn = (label: string, to: SettleStatus, danger?: boolean) =>
      <button type="button" key={to} className={danger ? s.btnGhostDanger : u.btnGhost}
        onClick={() => danger && armKey !== key ? arm(key) : advance(email, req, to)}>{label}</button>
    switch (req.status) {
      case 'pending': return [btn(t.actApprove, 'approved'), armKey === key
        ? <button type="button" key="reject-arm" className={s.btnDanger} onClick={() => advance(email, req, 'rejected')}>{t.confirmReject}</button>
        : btn(t.actReject, 'rejected', true)]
      case 'approved': return [btn(t.actProcess, 'processing')]
      /* processing / sent 由渠道回调推进（见 AdminConsole），运营不再手点终态；
         失败分支保留为明确的「模拟回调失败」，终死单仍走武装确认 */
      case 'processing': return [<span key="wait" className={s.waiting}>{t.waitingCallback}</span>]
      case 'sent': return [
        <span key="wait" className={s.waiting}>{t.waitingPaid}</span>,
        armKey === key
          ? <button type="button" key="fail-arm" className={s.btnDanger} onClick={() => advance(email, req, 'failed')}>{t.confirmFail}</button>
          : <button type="button" key="fail" className={s.btnGhostDanger} onClick={() => arm(key)}>{t.simulateFail}</button>,
      ]
      default: return [<span key="terminal" className={s.cellSub}>{t.terminal}</span>]
    }
  }
  const tone = (status: SettleStatus): 'ok' | 'info' | 'warn' | 'bad' | 'muted' =>
    status === 'paid' ? 'ok' : status === 'failed' ? 'bad' : status === 'rejected' ? 'muted' : status === 'pending' ? 'warn' : 'info'
  return <section className={s.section} aria-labelledby="admin-settle-title">
    <div className={s.sectionHead}><h2 id="admin-settle-title" className={s.srOnly}>{t.settle}</h2><span className={s.sectionNote}>{t.settleLead}{!writable && ` · ${t.readOnlyNote}`}</span></div>
    {rows.length === 0 ? <p className={s.empty}>{t.emptySettle}</p> : (
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>{t.colAccount}</th><th>{t.colNo}</th><th className={s.right}>{t.colAmount}</th><th>{t.colTime}</th><th>{t.colStatus}</th><th className={s.right}>{t.colBasis}</th><th>{t.colAct}</th></tr></thead>
          <tbody>
            {rows.map(({ email, req }) => <tr key={`${email}:${req.id}`}>
              <td className={u.mono}>{email}</td>
              <td className={u.mono}>{settleNo(req)}</td>
              <td className={`${s.right} ${u.mono}`}>{money(req.amount)}</td>
              <td className={u.mono}>{stampFull(req.at)}</td>
              <td><Badge tone={tone(req.status)}>{ADMIN_SETTLE_LABEL[req.status][lang]}</Badge></td>
              <td className={`${s.right} ${u.mono}`}>{money(pools.get(email) ?? 0)}<span className={s.cellSub}>{t.basisPool}</span></td>
              <td><div className={s.actRow}>{actions({ email, req })}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </section>
}

const OPS_PAGE = 12
/* Ops 面聚合四态：admin 是轮询观测面，秒级瞬态（创建/拉镜像/连接/排队/重启）
   到运营者眼前时早已翻页，细分无决策价值——收敛为「启动中」；
   租客实例页保留细分（用户正等着自己的实例起来，过程对租客有意义） */
const TRANSIENT_STATUSES: readonly string[] = ['Reserved', 'Creating', 'Loading', 'Connecting', 'Scheduling', 'Rebooting']
type OpsStatusKey = 'Running' | 'Starting' | 'Inactive' | 'Offline' | 'Expired' | 'Destroyed'
const OPS_STATUS_META: Record<OpsStatusKey, { zh: string; en: string; tone: 'ok' | 'info' | 'muted' | 'bad' }> = {
  Running: { zh: '运行中', en: 'Running', tone: 'ok' },
  Starting: { zh: '启动中', en: 'Starting', tone: 'info' },
  Inactive: { zh: '已停止', en: 'Inactive', tone: 'muted' },
  Offline: { zh: '宿主断连', en: 'Offline', tone: 'bad' },
  Expired: { zh: '租约到期', en: 'Expired', tone: 'muted' },
  Destroyed: { zh: '已销毁', en: 'Destroyed', tone: 'muted' },
}
const opsStatusKey = (st: InstanceStatus): OpsStatusKey =>
  TRANSIENT_STATUSES.includes(st) ? 'Starting' : st as OpsStatusKey
const END_USE_KEYS = ['training', 'inference', 'research', 'other'] as const

function OpsPanel({ t, lang, instances }: { t: Copy; lang: Language; instances: EndUseRow[] }) {
  /* 纯观测面：实例由宿主提供、租客租用，平台不介入运行中的实例（P2P 撮合定位）。
     合规强制与争议处置是独立能力（冻结结算/下架供给/保留证据），不是这里的运行干预 */
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | OpsStatusKey>('all')
  const [use, setUse] = useState<'all' | string>('all')
  const resetPage = <T,>(set: (v: T) => void) => (value: T) => { set(value); setPage(1) }
  const q = query.trim().toLowerCase()
  const filtered = instances.filter(({ email, order }) =>
    (status === 'all' || opsStatusKey(order.status) === status) &&
    (use === 'all' || order.endUse === use) &&
    (!q || email.toLowerCase().includes(q) || order.machine.toLowerCase().includes(q) || order.id.toLowerCase().includes(q)))
  const pages = Math.max(1, Math.ceil(filtered.length / OPS_PAGE))
  const current = Math.min(page, pages)
  const slice = filtered.slice((current - 1) * OPS_PAGE, current * OPS_PAGE)
  const head = <tr><th>{t.colAccount}</th><th>{t.colInstance}</th><th>{t.colStatus}</th><th>{t.colUse}</th><th className={s.right}>{t.colSpent}</th></tr>
  return <section className={s.section} aria-labelledby="admin-ops-title">
    <div className={s.sectionHead}><h2 id="admin-ops-title" className={s.srOnly}>{t.ops}</h2><span className={s.sectionNote}>{t.opsLead}</span></div>
    <div className={s.ledgerFilters}>
      <input type="search" value={query} placeholder={t.filterSearchOps} aria-label={t.filterSearchOps}
        className={s.filterInput} onChange={e => resetPage(setQuery)(e.target.value)} />
      <select value={status} aria-label={t.colStatus} className={s.filterSelect}
        onChange={e => resetPage(setStatus)(e.target.value as 'all' | OpsStatusKey)}>
        <option value="all">{t.filterAllStatus}</option>
        {(Object.keys(OPS_STATUS_META) as OpsStatusKey[]).map(k =>
          <option key={k} value={k}>{lang === 'zh' ? OPS_STATUS_META[k].zh : OPS_STATUS_META[k].en}</option>)}
      </select>
      <select value={use} aria-label={t.colUse} className={s.filterSelect}
        onChange={e => resetPage(setUse)(e.target.value)}>
        <option value="all">{t.filterAllUses}</option>
        {END_USE_KEYS.map(k => <option key={k} value={k}>{ADMIN_END_USE_LABEL[k][lang]}</option>)}
      </select>
    </div>
    <div className={s.tableWrap}>
      <table className={`${s.table} ${s.dense}`}>
        <thead>{head}</thead>
        {slice.length === 0
          ? <tbody><tr><td colSpan={5} className={s.emptyCell}>{instances.length === 0 ? t.emptyOps : t.filteredEmptyOps}</td></tr></tbody>
          : <tbody>
              {slice.map(({ email, order }) => <tr key={`${email}:${order.id}`}>
                <td className={u.mono}>{email}</td>
                <td><span className={u.mono}>{order.id}</span><span className={s.cellSub}>{order.machine} · {order.contractType === 'order' ? 'order' : 'ondemand'}</span></td>
                <td><Badge tone={OPS_STATUS_META[opsStatusKey(order.status)].tone}>{lang === 'zh' ? OPS_STATUS_META[opsStatusKey(order.status)].zh : OPS_STATUS_META[opsStatusKey(order.status)].en}</Badge></td>
                <td>{order.endUse ? <Badge tone="info">{ADMIN_END_USE_LABEL[order.endUse]?.[lang] ?? order.endUse}</Badge> : <span className={s.cellSub}>—</span>}</td>
                <td className={`${s.right} ${u.mono}`}>{money(order.spentTotal)}</td>
              </tr>)}
            </tbody>}
      </table>
    </div>
    {filtered.length > 0 && <div className={s.pager}>
      <span className={u.mono}>{t.pageInfo(current, pages, filtered.length)}</span>
      <div className={s.pagerBtns}>
        <button type="button" className={u.btnGhost} disabled={current <= 1} onClick={() => setPage(current - 1)}>{t.pagePrev}</button>
        <button type="button" className={u.btnGhost} disabled={current >= pages} onClick={() => setPage(current + 1)}>{t.pageNext}</button>
      </div>
    </div>}
  </section>
}

/* 用户管理（主体视角）：账号档案而非流水——身份、注册、名下机器、最近活跃；
   资金数字收进详情抽屉（资金是账务的领地，主表不与账务抢维度）。
   最近活跃降序：刚动过的账号排最前（客诉/巡检的自然切入点） */
const stampDate = (at: number) => stampFull(at).slice(0, 10)
const userBadges = (t: Copy, tenants: boolean, hosts: boolean) => <>
  {tenants && <Badge tone="muted">{t.roleTenant}</Badge>}
  {hosts && <Badge tone="ok">{t.roleHost}</Badge>}
</>

function UsersPanel({ t, lang, buckets, onViewLedger }: { t: Copy; lang: Language; buckets: AccountBucket[]; onViewLedger: (email: string) => void }) {
  const [open, setOpen] = useState<AccountBucket | null>(null)
  const rows = useMemo(() => buckets.map(bucket => {
    const w = bucket.wallet
    const lastLedger = w.ledger[0]?.at ?? 0
    const lastEarning = w.earningLedger[0]?.at ?? 0
    const lastOrder = w.orders.reduce((m, o) => Math.max(m, o.at), 0)
    return {
      bucket,
      tenants: w.payments.length > 0,
      hosts: w.earningLedger.length > 0,
      active: w.orders.filter(o => o.status !== 'Destroyed' && o.status !== 'Expired').length,
      spent: w.ledger.filter(l => l.kind === 'consume').reduce((sum, l) => sum + l.amount, 0),
      lastAt: Math.max(lastLedger, lastEarning, lastOrder, w.createdAt ?? 0),
    }
  }).sort((a, b) => b.lastAt - a.lastAt), [buckets])
  return <section className={s.section} aria-labelledby="admin-users-title">
    <div className={s.sectionHead}><h2 id="admin-users-title" className={s.srOnly}>{t.users}</h2><span className={s.sectionNote}>{t.usersLead}</span></div>
    <div className={s.tableWrap}>
      <table className={`${s.table} ${s.dense}`}>
        <thead><tr>
          <th>{t.colAccount}</th>
          <th>{t.colIdentity}</th>
          <th>{t.colJoined}</th>
          <th className={s.right}>{t.colMachines}</th>
          <th>{t.colActiveAt}</th>
          <th className={s.right}>{t.colSpent}</th>
          <th><span className={s.srOnly}>{t.uDetail}</span></th>
        </tr></thead>
        <tbody>
          {rows.map(row => <tr key={row.bucket.email} className={s.rowClick} onClick={() => setOpen(row.bucket)}>
            <td className={u.mono}>{row.bucket.email}</td>
            <td>{userBadges(t, row.tenants, row.hosts)}</td>
            <td>{row.bucket.wallet.createdAt ? stampDate(row.bucket.wallet.createdAt) : '—'}</td>
            <td className={s.right}>{row.bucket.wallet.orders.length > 0 ? <>
              {row.bucket.wallet.orders.length}
              <span className={s.cellSub}>{row.active} {t.machinesActive}</span>
            </> : '—'}</td>
            <td>{stampFull(row.lastAt)}</td>
            <td className={`${s.right} ${u.mono}`}>{money(row.spent)}</td>
            <td className={s.right}><button type="button" className={s.linkBtn} onClick={e => { e.stopPropagation(); setOpen(row.bucket) }}>{t.uDetail}</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {open && <UserDrawer t={t} lang={lang} bucket={open} onClose={() => setOpen(null)} onViewLedger={email => { setOpen(null); onViewLedger(email) }} />}
  </section>
}

/* 用户详情抽屉：档案字段共享，数据按身份分 tab（双身份显示切换，单身份直接展示）——
   租客侧（余额/消费/租用机器/流水）与宿主侧（收益/可结算/结算记录/流水）各自成册；
   机器列表默认 5 台 + 展开全部（数量可多可少，折叠态不撑爆抽屉）；
   流水表列序 [类型, 时间, 金额] 与机器表金额列同右缘（两表金额竖线对齐）；
   「查看完整流水」是最近流水的模块级延伸，放模块头而非抽屉 footer——footer 留给
   未来的账户级动作（封禁等，规格未定）；关闭双路径（✕ + 遮罩） */
const MACHINE_PREVIEW = 5
const signOf = (kind: LedgerKind) => (kind === 'topup' || kind === 'refund' || kind === 'earning') ? '+' : '−'

function UserDrawer({ t, lang, bucket, onClose, onViewLedger }: { t: Copy; lang: Language; bucket: AccountBucket; onClose: () => void; onViewLedger: (email: string) => void }) {
  const w = bucket.wallet
  const tenants = w.payments.length > 0
  const hosts = w.earningLedger.length > 0
  const [tab, setTab] = useState<'tenant' | 'host'>(tenants || !hosts ? 'tenant' : 'host')
  const [expanded, setExpanded] = useState(false)
  const spent = w.ledger.filter(l => l.kind === 'consume').reduce((sum, l) => sum + l.amount, 0)
  const kinds = ADMIN_KIND_LABEL[lang]
  const orders = [...w.orders].sort((a, b) => b.at - a.at)
  const shownOrders = expanded ? orders : orders.slice(0, MACHINE_PREVIEW)
  const recent = (tab === 'tenant' ? w.ledger : w.earningLedger).slice(0, 5)
  const settleInFlight = w.settleReqs.filter(r => r.status !== 'paid' && r.status !== 'rejected' && r.status !== 'failed').reduce((sum, r) => sum + r.amount, 0)
  const tabBar = tenants && hosts && <div className={s.drawerTabs} role="tablist">
    <button type="button" role="tab" aria-selected={tab === 'tenant'} className={`${s.drawerTab} ${tab === 'tenant' ? s.drawerTabOn : ''}`} onClick={() => { setTab('tenant'); setExpanded(false) }}>{t.uTabTenant}</button>
    <button type="button" role="tab" aria-selected={tab === 'host'} className={`${s.drawerTab} ${tab === 'host' ? s.drawerTabOn : ''}`} onClick={() => { setTab('host'); setExpanded(false) }}>{t.uTabHost}</button>
  </div>
  const recentHead = <h4 className={s.drawerH4Row}><span>{t.uRecent}</span><button type="button" className={s.drawerLink} onClick={() => onViewLedger(bucket.email)}>{t.uViewAll} →</button></h4>
  return <>
    <div className={s.drawerMask} onClick={onClose} />
    <aside className={`${s.drawer} ${s.drawerWide}`} role="dialog" aria-modal="true" aria-label={bucket.email}>
      <div className={s.drawerHead}>
        <h3 className={u.mono}>{bucket.email}</h3>
        <button type="button" className={s.drawerClose} onClick={onClose} aria-label={t.uClose}>✕</button>
      </div>
      <div className={s.drawerBody}>
        <dl className={s.drawerCols}>
          <div><dt>{t.colIdentity}</dt><dd>{userBadges(t, tenants, hosts)}</dd></div>
          <div><dt>{t.colJoined}</dt><dd>{w.createdAt ? stampDate(w.createdAt) : '—'}</dd></div>
        </dl>
        {tabBar}
        {tab === 'tenant' || !hosts ? <>
          <h4 className={s.drawerH4}>{t.uFunds}</h4>
          <dl className={s.drawerCols}>
            <div><dt>{t.colBalance}</dt><dd className={u.mono}>{money(w.balance)}</dd></div>
            <div><dt>{t.colSpent}</dt><dd className={u.mono}>{money(spent)}</dd></div>
          </dl>
          <h4 className={s.drawerH4}>{t.uMachines}</h4>
          {orders.length === 0 ? <p className={s.drawerEmpty}>{t.uNoMachines}</p> : <>
            <div className={s.drawerTableWrap}><table className={s.drawerTable}>
              <thead><tr><th>{t.colMachineLabel}</th><th>{t.colStatus}</th><th>{t.colStartedAt}</th><th className={s.right}>{t.colSpent}</th></tr></thead>
              <tbody>{shownOrders.map(o => {
                const meta = OPS_STATUS_META[opsStatusKey(o.status)]
                return <tr key={o.id}>
                  <td>{o.machine}</td>
                  <td><Badge tone={meta.tone}>{meta[lang]}</Badge></td>
                  <td>{stampFull(o.at)}</td>
                  <td className={`${s.right} ${u.mono}`}>{money(o.spentTotal)}</td>
                </tr>
              })}</tbody>
            </table></div>
            {orders.length > MACHINE_PREVIEW && <button type="button" className={s.drawerMore} onClick={() => setExpanded(v => !v)}>
              {expanded ? t.uCollapse : t.uExpandAll(orders.length)}
            </button>}
          </>}
          {recentHead}
          <div className={s.drawerTableWrap}><table className={s.drawerTable}>
            <thead><tr><th>{t.colKind}</th><th>{t.colAt}</th><th className={s.right}>{t.colAmount}</th></tr></thead>
            <tbody>{recent.map(l => <tr key={l.id}>
              <td>{kinds[l.kind]}</td>
              <td>{stampFull(l.at)}</td>
              <td className={`${s.right} ${u.mono}`}>{signOf(l.kind)}{money(l.amount)}</td>
            </tr>)}</tbody>
          </table></div>
        </> : <>
          <h4 className={s.drawerH4}>{t.uFunds}</h4>
          <dl className={s.drawerCols}>
            <div><dt>{t.colEarningTotal}</dt><dd className={u.mono}>{money(w.earnings)}</dd></div>
            <div><dt>{t.uSettleable}</dt><dd className={u.mono}>{money(settleable(w))}</dd></div>
            <div><dt>{t.uSettleInFlight}</dt><dd className={u.mono}>{money(settleInFlight)}</dd></div>
          </dl>
          <h4 className={s.drawerH4}>{t.uSettleRecords}</h4>
          {w.settleReqs.length === 0 ? <p className={s.drawerEmpty}>{t.uNoSettle}</p> : (
            <div className={s.drawerTableWrap}><table className={s.drawerTable}>
              <thead><tr><th>{t.colAt}</th><th>{t.colStatus}</th><th className={s.right}>{t.colAmount}</th></tr></thead>
              <tbody>{[...w.settleReqs].sort((a, b) => b.at - a.at).map(r => <tr key={r.id}>
                <td>{stampFull(r.at)}</td>
                <td><Badge tone={r.status === 'paid' ? 'ok' : r.status === 'rejected' || r.status === 'failed' ? 'bad' : 'info'}>{ADMIN_SETTLE_LABEL[r.status][lang]}</Badge></td>
                <td className={`${s.right} ${u.mono}`}>{money(r.amount)}</td>
              </tr>)}</tbody>
            </table></div>
          )}
          {recentHead}
          <div className={s.drawerTableWrap}><table className={s.drawerTable}>
            <thead><tr><th>{t.colKind}</th><th>{t.colAt}</th><th className={s.right}>{t.colAmount}</th></tr></thead>
            <tbody>{recent.map(l => <tr key={l.id}>
              <td>{kinds[l.kind]}</td>
              <td>{stampFull(l.at)}</td>
              <td className={`${s.right} ${u.mono}`}>{signOf(l.kind)}{money(l.amount)}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
      </div>
    </aside>
  </>
}

/* 管理员与角色：规划中角色模型的静态预览——当前版本单管理员（见 GATE），
   矩阵不随登录态生效；行按侧边导航三组分组，权限格三态用手绘 SVG（图例见表下） */
type Perm = 'yes' | 'ro' | 'no'
const ROLE_COLS: { key: string; label: (t: Copy) => string; desc: (t: Copy) => string }[] = [
  { key: 'super', label: t => t.roleSuper, desc: t => t.roleSuperDesc },
  { key: 'finance', label: t => t.roleFinance, desc: t => t.roleFinanceDesc },
  { key: 'compliance', label: t => t.roleCompliance, desc: t => t.roleComplianceDesc },
  { key: 'viewer', label: t => t.roleViewer, desc: t => t.roleViewerDesc },
]
const ROLE_GROUPS: { label: (t: Copy) => string; rows: { key: SectionKey; perms: Perm[] }[] }[] = [
  {
    label: t => t.groupMonitor,
    rows: [
      { key: 'overview', perms: ['yes', 'yes', 'yes', 'ro'] },
      { key: 'ledger', perms: ['yes', 'yes', 'ro', 'ro'] },
      { key: 'users', perms: ['yes', 'yes', 'no', 'ro'] },
    ],
  },
  {
    label: t => t.groupFunds,
    rows: [
      { key: 'settle', perms: ['yes', 'yes', 'no', 'ro'] },
      { key: 'rate', perms: ['yes', 'yes', 'no', 'no'] },
    ],
  },
  {
    label: t => t.groupOps,
    rows: [
      { key: 'ops', perms: ['yes', 'ro', 'yes', 'ro'] },
      { key: 'leads', perms: ['yes', 'no', 'yes', 'ro'] },
      { key: 'roles', perms: ['yes', 'no', 'no', 'no'] },
      { key: 'audit', perms: ['yes', 'yes', 'yes', 'ro'] },
    ],
  },
]
/* 展示与执行同一信源：本矩阵既渲染角色页表格，也经 PERM_BY_ROLE 驱动
   导航过滤（canSee）与写操作拦截（canWrite）——矩阵不再只是说明书 */
const PERM_BY_ROLE = (() => {
  const map = {} as Record<AdminRole, Partial<Record<SectionKey, Perm>>>
  ROLE_COLS.forEach((col, i) => {
    const per: Partial<Record<SectionKey, Perm>> = {}
    ROLE_GROUPS.forEach(g => g.rows.forEach(r => { per[r.key] = r.perms[i] }))
    map[col.key as AdminRole] = per
  })
  return map
})()
const permOf = (role: AdminRole, key: SectionKey): Perm => PERM_BY_ROLE[role][key] ?? 'no'
const canSee = (role: AdminRole, key: SectionKey) => permOf(role, key) !== 'no'
const canWrite = (role: AdminRole, key: SectionKey) => permOf(role, key) === 'yes'
/* 三态权限标：手绘 13px 线性图标（勾/眼/横线），颜色按语义分级，aria 用文字兜底 */
function PermMark({ perm, label }: { perm: Perm; label: string }) {
  if (perm === 'yes') return <svg className={`${s.permIcon} ${s.permYes}`} viewBox="0 0 14 14" width="13" height="13" role="img" aria-label={label}><path d="M2.5 7.6l3.2 3 5.8-6.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (perm === 'ro') return <svg className={`${s.permIcon} ${s.permRo}`} viewBox="0 0 14 14" width="13" height="13" role="img" aria-label={label}><path d="M1.6 7c1.6-2.7 3.4-4 5.4-4s3.8 1.3 5.4 4c-1.6 2.7-3.4 4-5.4 4S3.2 9.7 1.6 7Z" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="7" cy="7" r="1.7" fill="currentColor" /></svg>
  return <svg className={`${s.permIcon} ${s.permNo}`} viewBox="0 0 14 14" width="13" height="13" role="img" aria-label={label}><path d="M3.2 7h7.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
}
/* 管理员与角色：矩阵是展示与执行的同一信源（PERM_BY_ROLE 驱动导航/写拦截），
   账户名单为演示态本地存储；行按侧边导航三组分组，权限格三态手绘 SVG（图例见表下） */
function RolesPanel({ t, admins, operator, onToast }: { t: Copy; admins: AdminAccount[]; operator: string; onToast: (text: string, tone: 'ok' | 'bad') => void }) {
  const permLabel = (perm: Perm) => perm === 'yes' ? t.permYesLabel : perm === 'ro' ? t.permRo : t.permNoLabel
  /* 账户管理：自账号不可停/移（当前登录者），最后一个启用超管不可停/移（防自锁，store 兜底） */
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('finance')
  const [err, setErr] = useState<string | null>(null)
  const [armEmail, setArmEmail] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const self = operator.trim().toLowerCase()
  const activeSupers = admins.filter(a => a.role === 'super' && a.status === 'active').length
  const lockReason = (a: AdminAccount) =>
    a.email === self ? t.errSelf
      : a.role === 'super' && a.status === 'active' && activeSupers <= 1 ? t.errLastSuper : null
  const submit = () => {
    const res = adminAdd(email, newRole)
    if (res) {
      const msg = res === 'exists' ? t.errAcctExists : t.errAcctInvalid
      setErr(msg); onToast(msg, 'bad'); return
    }
    const added = email.trim().toLowerCase()
    setErr(null); setEmail(''); onToast(t.toastAcctAdded(added), 'ok')
  }
  const toggle = (a: AdminAccount) => {
    const next = a.status === 'active' ? 'disabled' : 'active'
    if (!adminSetStatus(a.email, next)) { onToast(t.errLastSuper, 'bad'); return }
    onToast(`${a.email} · ${next === 'active' ? t.statusActive : t.statusDisabled}`, 'ok')
  }
  const remove = (a: AdminAccount) => {
    window.clearTimeout(timer.current); setArmEmail(null)
    if (!adminRemove(a.email)) { onToast(t.errLastSuper, 'bad'); return }
    onToast(t.toastAcctRemoved(a.email), 'ok')
  }
  const armRemove = (email: string) => {
    setArmEmail(email)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setArmEmail(current => current === email ? null : current), 3000)
  }
  return <section className={s.section} aria-labelledby="admin-roles-title">
    <div className={s.sectionHead}><h2 id="admin-roles-title" className={s.srOnly}>{t.roles}</h2><span className={s.sectionNote}>{t.rolesLead}</span></div>
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr>
          <th scope="col">{t.colSection}</th>
          {ROLE_COLS.map(col => <th key={col.key} scope="col" className={s.center}>
            <span className={s.roleTh}>
              <span className={s.roleThName}>{col.label(t)}{col.key === 'super' && <span className={s.roleNow}>{t.roleNow}</span>}</span>
              <span className={s.roleThDesc}>{col.desc(t)}</span>
            </span>
          </th>)}
        </tr></thead>
        {ROLE_GROUPS.map(group => <tbody key={group.label(t)}>
          <tr className={s.matrixGroup}><td colSpan={5}>{group.label(t)}</td></tr>
          {group.rows.map(row => <tr key={row.key}>
            <td>{SECTION_LABEL[row.key](t)}</td>
            {row.perms.map((perm, i) => <td key={ROLE_COLS[i].key} className={s.center}><PermMark perm={perm} label={permLabel(perm)} /></td>)}
          </tr>)}
        </tbody>)}
      </table>
    </div>
    <div className={s.matrixLegend}>
      {(['yes', 'ro', 'no'] as Perm[]).map(perm => <span key={perm} className={s.legendItem}><PermMark perm={perm} label={permLabel(perm)} />{permLabel(perm)}</span>)}
    </div>
    {/* 账户名单（演示态）：添加/停用/启用/移除均走 store 留痕，1s 轮询回读刷新本表 */}
    <h3 className={s.blockHead}>{t.acctTitle}</h3>
    <p className={s.blockLead}>{t.acctLead}</p>
    <div className={s.acctForm}>
      <input type="email" className={s.filterInput} value={email} placeholder={t.acctEmailPh}
        aria-label={t.colEmail} onChange={e => { setEmail(e.target.value); setErr(null) }}
        onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      <select className={s.filterSelect} value={newRole} aria-label={t.colRole}
        onChange={e => setNewRole(e.target.value as AdminRole)}>
        {ROLE_COLS.map(c => <option key={c.key} value={c.key}>{c.label(t)}</option>)}
      </select>
      <button type="button" className={u.btnPrimary} onClick={submit}>{t.acctSubmit}</button>
      {err && <span role="alert" className={s.rateErr}>{err}</span>}
    </div>
    <div className={s.tableWrap}>
      <table className={`${s.table} ${s.dense}`}>
        <thead><tr><th>{t.colEmail}</th><th>{t.colRole}</th><th>{t.colStatus}</th><th>{t.colAdded}</th><th className={s.right}>{t.colAction}</th></tr></thead>
        <tbody>
          {admins.map(a => {
            const reason = lockReason(a)
            return <tr key={a.email}>
              <td className={u.mono}>{a.email}</td>
              <td>{ROLE_COLS.find(c => c.key === a.role)?.label(t) ?? a.role}</td>
              <td><Badge tone={a.status === 'active' ? 'ok' : 'muted'}>{a.status === 'active' ? t.statusActive : t.statusDisabled}</Badge></td>
              <td className={u.mono}>{a.addedAt ? stampDate(a.addedAt) : t.acctBuiltin}</td>
              <td className={s.right}>
                {reason
                  ? <><button type="button" className={u.btnGhost} disabled title={reason}>{a.status === 'active' ? t.acctDisable : t.acctEnable}</button>{' '}
                    <button type="button" className={s.btnGhostDanger} disabled title={reason}>{t.acctRemove}</button></>
                  : <>
                    <button type="button" className={u.btnGhost} onClick={() => toggle(a)}>{a.status === 'active' ? t.acctDisable : t.acctEnable}</button>{' '}
                    {armEmail === a.email
                      ? <button type="button" className={s.btnDanger} onClick={() => remove(a)}>{t.confirmRemove}</button>
                      : <button type="button" className={s.btnGhostDanger} onClick={() => armRemove(a.email)}>{t.acctRemove}</button>}
                  </>}
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  </section>
}

function LeadsPanel({ t, rows }: { t: Copy; rows: Lead[] }) {
  return <section className={s.section} aria-labelledby="admin-leads-title">
    <div className={s.sectionHead}><h2 id="admin-leads-title" className={s.srOnly}>{t.leads}</h2><span className={s.sectionNote}>{t.leadsLead}</span></div>
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>{t.colTime}</th><th>{t.colCompany}</th><th>{t.colContact}</th><th>{t.colEmail}</th><th>{t.colPurpose}</th><th>{t.colGpu}</th><th>{t.colReq}</th></tr></thead>
        {rows.length === 0
          ? <tbody><tr><td colSpan={7} className={s.emptyCell}>{t.emptyLeads}</td></tr></tbody>
          : <tbody>
              {rows.map((lead, index) => <tr key={`${lead.at}-${index}`}>
                <td className={u.mono}>{stampFull(lead.at)}</td>
                <td>{lead.company}</td>
                <td>{lead.contact}</td>
                <td className={u.mono}>{lead.email}</td>
                <td>{lead.purpose.join('、')}</td>
                <td>{lead.gpu.join('、')}{lead.gpu.length > 0 && lead.quantity ? ' · ' : ''}{lead.quantity}</td>
                <td className={s.descCell}>{lead.requirements || '—'}</td>
              </tr>)}
            </tbody>}
      </table>
    </div>
  </section>
}

/* 操作记录：结算推进/强停/抽成调整的留痕（adminStore 单点写入），可追溯 */
function AuditPanel({ t, lang, rows }: { t: Copy; lang: Language; rows: AdminLog[] }) {
  const actionLabel = (action: AdminLog['action']) =>
    action === 'settle.advance' ? t.logSettle
      : action === 'instance.stop' ? t.logStop
      : action === 'admin.add' ? t.logAdminAdd
      : action === 'admin.status' ? t.logAdminStatus
      : action === 'admin.remove' ? t.logAdminRemove
      : t.logRate
  const change = (row: AdminLog) => {
    /* admin 类：detail 是角色键 / 启停态，展示层换成当前语言的叫法 */
    if (row.action === 'admin.add' || row.action === 'admin.remove') {
      return ROLE_COLS.find(c => c.key === row.detail)?.label(t) ?? row.detail
    }
    if (row.action === 'admin.status') return row.detail === 'active' ? t.statusActive : t.statusDisabled
    if (row.action === 'settle.advance') {
      const [email, to] = (row.detail || '').split(' → ')
      const label = ADMIN_SETTLE_LABEL[to as SettleStatus]?.[lang]
      return label ? <>{email && <span className={s.cellSub}>{email}</span>}{label}</> : row.detail
    }
    return row.detail
  }
  /* rate 类记录 target 是内部键 'rate'，展示层换成当前语言的参数名 */
  const target = (row: AdminLog) => row.action === 'rate.update' ? t.rate : row.target
  return <section className={s.section} aria-labelledby="admin-audit-title">
    <div className={s.sectionHead}><h2 id="admin-audit-title" className={s.srOnly}>{t.audit}</h2><span className={s.sectionNote}>{t.auditLead}</span></div>
    {rows.length === 0 ? <p className={s.empty}>{t.auditEmpty}</p> : (
      <div className={s.tableWrap}>
        <table className={`${s.table} ${s.dense}`}>
          <thead><tr><th>{t.colTime}</th><th>{t.colAction}</th><th>{t.colTarget}</th><th>{t.colChange}</th><th>{t.colOperator}</th></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={`${row.at}-${index}`}>
              <td className={u.mono}>{stampFull(row.at)}</td>
              <td><Badge tone={row.action === 'instance.stop' || row.action === 'admin.remove' ? 'bad' : 'info'}>{actionLabel(row.action)}</Badge></td>
              <td className={u.mono}>{target(row)}</td>
              <td className={s.descCell}>{change(row)}</td>
              <td className={u.mono}>{row.operator === 'channel' ? t.operatorChannel : row.operator || ADMIN_EMAIL}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </section>
}
