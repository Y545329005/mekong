/* ============================================================================
   THESIS  租客实例页回答：我开通了哪些实例、现在什么状态、约定跑多久、
           花了多少、怎么连与怎么停。实例＝订单的资产运维视图：支付即开通
           （订单是唯一事实源，不建独立实例实体）；状态由真实钟引擎推进，
           销毁/取消的资金变动全部走 store 纯操作并与资金页流水对账。
   OWN-WORLD  白底，页面骨架复用资金页（WalletPage.module.css），实例卡
           样式在本页 module.css，色板与资金页同源。
   STORY  下单支付 → 订单落账（起步 Creating）→ 状态机推进到 Running →
           到期转 Expired（保留展示）→ 销毁结案（退款/罚金落流水）。
   FORM  汇总卡（运行中 + 合计时价 + 去租用）→ 实例卡片流（分页）→
           SSH / 端口 / 日志弹窗。
   ========================================================================== */

import { useEffect, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { money, stamp, stampFull, useWallet, applyTick, applyInstLabel, applyInstStop, applyInstReboot, applyInstStart, applyInstDestroy, statusLabel, STATUS_TONES } from './wallet/store'
import type { InstanceStatus, OrderRow, WalletState } from './wallet/store'
import { Overlay } from './wallet/ui'
import Icon from './Icons'
import u from './wallet/ui.module.css'
import s from './WalletPage.module.css'
import c from './InstancesPage.module.css'

const INST_PAGE = 6
/* 进度条琥珀预警线：剩余不足 2 小时 */
const WARN_MS = 2 * 3600000
/* 活跃态：计价与「运行中」汇总口径 */
const ACTIVE = ['Running', 'Creating', 'Loading', 'Connecting', 'Rebooting', 'Scheduling']
/* 状态筛选：状态多 → 分族比翻页更接近用户的问题（在用的 / 停掉的 / 已经结束的） */
type InstFilter = 'all' | 'active' | 'stopped' | 'history'
const FILTER_GROUPS: Record<InstFilter, InstanceStatus[] | null> = {
  all: null,
  active: ['Running', 'Creating', 'Loading', 'Connecting', 'Rebooting', 'Scheduling', 'Offline'],
  stopped: ['Inactive'],
  history: ['Expired', 'Destroyed'],
}
const FILTERS: InstFilter[] = ['all', 'active', 'stopped', 'history']
/* 工作区落点：迅达云白标二级域名控制台（对接篇约定 gpu-console.<迅达云域名>）。
   真实白标域名由迅达云提供后只改这一处；演示期为约定形态。 */
const WORKSPACE_URL = 'https://gpu-console.xundayun.com'

const durTxt = (ms: number) => {
  if (!(ms > 0)) return '0m'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), rm = m % 60
  if (h < 48) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

const copy = {
  zh: {
    title: '实例',
    summary: (active: number, rate: string) => `${active} 台运行中 · 合计时价 $${rate}/h`,
    summaryNone: '暂无运行中实例',
    list: '实例列表',
    rate: '时价',
    spent: '已花费',
    period: '使用时段',
    gpu: '利用率',
    ip: 'IP',
    remain: '剩余',
    expireAt: '到期',
    noStop: '时段订单租期内不可中断，提前取消将收取违约金。',
    waitBoot: '预付冻结中，未开始计费',
    bootAt: '预计开机',
    open: '打开',
    openHint: '开机完成后可打开',
    ssh: 'SSH', reboot: '重启', stop: '停止', start: '启动', logs: '日志', ports: '端口',
    destroy: '销毁', cancel: '取消',
    reserveCancelBtn: '取消预定',
    confirmOd: '销毁后停止计费，数据不可恢复。',
    confirmOrder: (r: string, p: string) => `提前取消：预计退回 ${r}，违约金 ${p}（未摊销部分的 15%）。`,
    confirmReserve: (v: string) => `到点前取消预定，预付 ${v} 将全额退回余额。`,
    confirmExpired: '实例已到期，销毁后数据清除。',
    expiredStartTip: '已到期实例不可重启（48h 删除窗口）',
    debt: '余额不足停机',
    debtHint: '余额耗尽后已自动停机，充值后点「启动」恢复。',
    jupyter: 'Jupyter',
    destroyedNote: '已销毁 · 记录保留',
    alertOffline: '宿主断连：到期时刻顺延；超过 5 分钟将自动终止并全额退款。',
    alertExpired: '租约已到期，数据保留 48 小时，请尽快销毁或到市场重新租用。',
    empty: '还没有实例。',
    emptyFilter: '没有符合条件的实例。',
    filterLabel: '按状态筛选',
    filterAll: '全部',
    filterActive: '运行',
    filterStopped: '停止',
    filterHistory: '历史',
    browse: '去算力市场挑一台 →',
    total: (n: number) => `共 ${n} 台`,
    prev: '上一页', next: '下一页',
    pageOf: (i: number, n: number) => `第 ${i} / ${n} 页`,
    pagination: '分页',
    labelTip: '点击改名',
    copied: '已复制',
    copy: '复制',
    sshTitle: (id: string) => `SSH 连接 · ${id}`,
    portsTitle: (id: string) => `端口映射 · ${id}`,
    logsTitle: (id: string) => `运行日志 · ${id}`,
    close: '关闭',
    sshNote1: '首次连接如提示主机指纹，输入 yes 确认。',
    sshNote2: '外部端口由网关映射到容器内 22 端口。',
    portsExt: '外部地址', portsInt: '容器端口', portsUse: '用途',
    useSsh: 'SSH', useHttp: 'HTTP 服务', useCustom: '自定义',
    utilNote: '利用率采样自 GPU 计数器',
  },
  en: {
    title: 'Instances',
    summary: (active: number, rate: string) => `${active} running · combined rate $${rate}/h`,
    summaryNone: 'No instances running',
    list: 'Instances',
    rate: 'Rate',
    spent: 'Spent',
    period: 'Period',
    gpu: 'Utilization',
    ip: 'IP',
    remain: 'Remaining',
    expireAt: 'Expires',
    noStop: 'Term orders cannot be interrupted; early cancellation incurs a penalty.',
    waitBoot: 'Prepaid and frozen, not billing yet',
    bootAt: 'Boots at',
    open: 'Open',
    openHint: 'Available once the instance is running',
    ssh: 'SSH', reboot: 'Reboot', stop: 'Stop', start: 'Start', logs: 'Logs', ports: 'Ports',
    destroy: 'Destroy', cancel: 'Cancel',
    reserveCancelBtn: 'Cancel reservation',
    confirmOd: 'Destroying stops all billing. Data cannot be recovered.',
    confirmOrder: (r: string, p: string) => `Early cancellation: about ${r} refunded, penalty ${p} (15% of the unamortized amount).`,
    confirmReserve: (v: string) => `Cancel before start time and the full prepayment of ${v} returns to your balance.`,
    confirmExpired: 'The term has ended; destroying clears the data.',
    expiredStartTip: 'Expired instances cannot restart (48h deletion window)',
    debt: 'Stopped: low balance',
    debtHint: 'Stopped automatically when the balance ran out. Top up, then press Start.',
    jupyter: 'Jupyter',
    destroyedNote: 'Destroyed · record kept',
    alertOffline: 'Host disconnected: the expiry time is extended; after 5 minutes the order is terminated with a full refund.',
    alertExpired: 'The term has ended. Data is kept for 48 hours — destroy it or rent again from the market.',
    empty: 'No instances yet.',
    emptyFilter: 'No instances match this filter.',
    filterLabel: 'Filter by status',
    filterAll: 'All',
    filterActive: 'Running',
    filterStopped: 'Stopped',
    filterHistory: 'History',
    browse: 'Browse the marketplace →',
    total: (n: number) => `${n} instances`,
    prev: 'Previous', next: 'Next',
    pageOf: (i: number, n: number) => `Page ${i} of ${n}`,
    pagination: 'Pagination',
    labelTip: 'Click to rename',
    copied: 'Copied',
    copy: 'Copy',
    sshTitle: (id: string) => `SSH · ${id}`,
    portsTitle: (id: string) => `Port mapping · ${id}`,
    logsTitle: (id: string) => `Logs · ${id}`,
    close: 'Close',
    sshNote1: 'If the host fingerprint is prompted on first connect, confirm with yes.',
    sshNote2: 'The external port is mapped by the gateway to port 22 inside the container.',
    portsExt: 'External', portsInt: 'Container port', portsUse: 'Purpose',
    useSsh: 'SSH', useHttp: 'HTTP service', useCustom: 'Custom',
    utilNote: 'Utilization sampled from GPU counters',
  },
} as const

type Copy = typeof copy[Language]

export default function InstancesPage({ lang, account, onSignIn }: {
  lang: Language
  account: Account | null
  onSignIn: (email: string) => void
}) {
  if (!account) return <WalletLocked lang={lang} onSignIn={onSignIn} title={copy[lang].title} />
  return <InstancesAccount key={account.email} lang={lang} email={account.email} />
}

function InstancesAccount({ lang, email }: { lang: Language; email: string }) {
  const t = copy[lang]
  const { wallet, setWallet } = useWallet(email)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<null | { kind: 'ssh' | 'ports' | 'logs'; id: string }>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  /* 实例引擎：真实钟每秒推进；离开页面即停，回来由 tickAt 补齐（上限 1 分钟） */
  useEffect(() => {
    const iv = setInterval(() => setWallet((prev: WalletState) => applyTick(prev)), 1000)
    return () => clearInterval(iv)
  }, [setWallet])

  const act = {
    label: (id: string, label: string) => setWallet(prev => applyInstLabel(prev, id, label)),
    stop: (id: string) => setWallet(prev => applyInstStop(prev, id)),
    reboot: (id: string) => setWallet(prev => applyInstReboot(prev, id)),
    start: (id: string) => setWallet(prev => applyInstStart(prev, id)),
    destroy: (id: string) => { setWallet(prev => applyInstDestroy(prev, id)); setConfirmId(null) },
  }

  const active = wallet.orders.filter(o => ACTIVE.includes(o.status))
  const rateSum = Math.round(active.reduce((sum, o) => sum + o.dph, 0) * 100) / 100
  const [filter, setFilter] = useState<InstFilter>('all')
  const group = FILTER_GROUPS[filter]
  /* 已销毁沉底：在役与历史同一列表时，历史不打断当前操作 */
  const ordered = [...(group ? wallet.orders.filter(o => group.includes(o.status)) : wallet.orders)]
    .sort((a, b) => (a.status === 'Destroyed' ? 1 : 0) - (b.status === 'Destroyed' ? 1 : 0))
  const pages = Math.max(1, Math.ceil(ordered.length / INST_PAGE))
  const safePage = Math.min(page, pages)
  const visible = ordered.slice((safePage - 1) * INST_PAGE, safePage * INST_PAGE)
  const modalOrder = modal ? wallet.orders.find(o => o.id === modal.id) : undefined

  return <div className={s.page}>
    <div className={s.shell}>
      {/* 一行工具区：标题 + 全局统计在左，筛选与紧凑分页在右；页面只需一个标题 */}
      <header className={c.headRow}>
        <h1 className={c.title}>{t.title}</h1>
        <p className={c.summary} aria-live="polite">
          {active.length ? t.summary(active.length, rateSum.toFixed(2)) : t.summaryNone}
        </p>
        <div className={c.toolbar}>
          <div className={s.filters} role="group" aria-label={t.filterLabel}>
            {FILTERS.map(f => <button key={f} type="button" className={`${s.filter} ${c.chip}`}
              data-active={filter === f}
              aria-pressed={filter === f}
              onClick={() => { setFilter(f); setPage(1) }}>
              {f === 'all' ? t.filterAll : f === 'active' ? t.filterActive : f === 'stopped' ? t.filterStopped : t.filterHistory}
            </button>)}
          </div>
          <nav className={c.pager} aria-label={t.pagination}>
            <button type="button" className={c.pagerBtn} disabled={safePage <= 1}
              aria-label={t.prev} onClick={() => setPage(safePage - 1)}>
              <Icon name="chevron" size={13} />
            </button>
            <span className={c.pagerPos} aria-live="polite">{safePage} / {pages}</span>
            <button type="button" className={c.pagerBtn} disabled={safePage >= pages}
              aria-label={t.next} onClick={() => setPage(safePage + 1)}>
              <Icon name="chevron" size={13} />
            </button>
          </nav>
        </div>
      </header>

      <section aria-label={t.list}>
        {wallet.orders.length === 0 ? (
          <div className={c.card} style={{ padding: '44px 24px', textAlign: 'center' }}>
            <p className={s.empty} style={{ border: 0, padding: 0 }}>{t.empty}</p>
            <p style={{ margin: '10px 0 16px' }}><a href="#/rent" style={{ color: '#315f90' }}>{t.browse}</a></p>
            <a className={u.btnPrimary} href="#/rent">{t.browse}</a>
          </div>
        ) : ordered.length === 0 ? (
          <p className={s.empty}>{t.emptyFilter}</p>
        ) : (
          <div className={c.cards}>
            {visible.map(o => <InstanceCard key={o.id} o={o} lang={lang} t={t} onConfirmOpen={setConfirmId}
              confirmOpen={confirmId === o.id} act={act} onInfo={setModal} />)}
          </div>
        )}
      </section>
    </div>

    {modalOrder && modal && <InfoModal kind={modal.kind} o={modalOrder} lang={lang} t={t} onClose={() => setModal(null)} />}
  </div>
}

/* 每卡局部态（确认条 / 名称编辑 / 复制反馈）不进全局状态 */
function InstanceCard({ o, lang, t, confirmOpen, onConfirmOpen, act, onInfo }: {
  o: OrderRow
  lang: Language
  t: Copy
  confirmOpen: boolean
  onConfirmOpen: (id: string | null) => void
  act: { label: (id: string, label: string) => void; stop: (id: string) => void; reboot: (id: string) => void; start: (id: string) => void; destroy: (id: string) => void }
  onInfo: (m: { kind: 'ssh' | 'ports' | 'logs'; id: string } | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const tone = STATUS_TONES[o.status]
  const pulse = ['Reserved', 'Creating', 'Loading', 'Connecting', 'Rebooting', 'Scheduling'].includes(o.status)
  const runningLike = ['Running', 'Creating', 'Loading', 'Connecting'].includes(o.status)
  const canOpen = o.status === 'Running'
  const ondemand = o.contractType === 'ondemand'
  const isReserved = o.status === 'Reserved'
  const expired = o.status === 'Expired'
  const destroyed = o.status === 'Destroyed'
  const now = Date.now()

  const util = o.status === 'Running'
    ? Math.round(60 + 35 * Math.sin(now / 83000 + [...o.id].reduce((a, ch) => a + ch.charCodeAt(0), 0)))
    : null

  const remain = o.rentalEnd ? o.rentalEnd - now : null
  const barFrac = o.rentalEnd && !isReserved && !destroyed && remain != null
    ? Math.min(1, Math.max(0, (o.rentalEnd - o.at) > 0 ? (o.rentalEnd - now) / (o.rentalEnd - o.at) : 0))
    : null
  const warn = remain != null && remain < WARN_MS

  const copySsh = () => {
    const cmd = `ssh ubuntu@${o.ip} -p ${o.port22}`
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => { /* 剪贴板不可用（非安全上下文）：命令仍在弹窗中可手动复制 */ })
  }

  const commitLabel = () => {
    act.label(o.id, draft)
    setEditing(false)
  }

  const penalty = Math.round(o.escrowHold * 0.15 * 100) / 100
  const refund = Math.round((o.escrowHold - penalty) * 100) / 100

  const confirmText = isReserved ? t.confirmReserve(money(o.escrowHold))
    : expired ? t.confirmExpired
      : ondemand ? t.confirmOd
        : t.confirmOrder(money(refund), money(penalty))
  const confirmBtn = isReserved ? t.reserveCancelBtn : t.destroy

  return <article className={c.card} data-destroyed={destroyed || undefined}>
    <div className={c.cardHead}>
      <span className={c.statusPill} data-tone={tone}>
        {pulse && <span className={c.pulseDot} aria-hidden="true" />}
        {statusLabel(lang, o.status)}
      </span>
      {editing && !destroyed ? (
        <input autoFocus className={c.nameInput} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commitLabel} onKeyDown={e => e.key === 'Enter' && commitLabel()} aria-label={t.labelTip} />
      ) : destroyed ? (
        <h3 className={c.name}>{o.label ?? o.machine}</h3>
      ) : (
        <h3 className={c.name} title={t.labelTip}>
          <button type="button" onClick={() => { setDraft(o.label ?? ''); setEditing(true) }}
            style={{ all: 'unset', cursor: 'text', color: 'inherit', font: 'inherit' }}>
            {o.label ?? o.machine}<span className={c.nameHint}>{t.labelTip}</span>
          </button>
        </h3>
      )}
      {o.debtStopped && <span className={c.skuTag} data-tone="bad">{t.debt}</span>}
      {destroyed && <span className={c.skuTag} data-tone="muted">{t.destroyedNote}</span>}
    </div>

    <div className={c.specRow}>
      <span>{o.gpu} · {o.diskGb} GB</span>
      <span className={c.specImage}>{o.imageTag}</span>
    </div>

    <div className={c.divider} />

    {isReserved ? (
      <p className={c.reservedEcho}>{t.waitBoot} · {t.bootAt} {stamp(o.phaseUntil ?? o.at)}</p>
    ) : (
      <div className={destroyed ? c.statsQuiet : c.stats}>
        <div>
          <div className={c.statLabel}>{t.rate}</div>
          <div className={c.statValue}>{money(o.dph)}/h</div>
        </div>
        <div>
          <div className={c.statLabel}>{t.spent}</div>
          <div className={c.statValue}>{money(ondemand ? o.spentTotal : o.amortized)}</div>
        </div>
        {destroyed ? (
          <div>
            <div className={c.statLabel}>{t.period}</div>
            <div className={c.statValue} data-dense="">{stampFull(o.at)} – {stampFull(o.destroyedAt ?? o.at)}</div>
            <div className={c.statSub}>{durTxt((o.destroyedAt ?? o.at) - o.at)}</div>
          </div>
        ) : <>
          <div>
            <div className={c.statLabel}>{t.gpu}</div>
            {util != null
              ? <div className={c.statValue} data-tone="ok" title={t.utilNote}>{util}%</div>
              : <div className={c.statValue} style={{ color: '#627386' }}>—</div>}
          </div>
          <div>
            <div className={c.statLabel}>{t.ip}</div>
            {o.ip
              ? <button type="button" className={c.ipBtn} onClick={copySsh} title={`ssh ubuntu@${o.ip} -p ${o.port22}`}>{copied ? t.copied : o.ip}</button>
              : <div className={c.statValue} style={{ color: '#627386' }}>—</div>}
          </div>
        </>}
      </div>
    )}

    {barFrac != null && <div className={c.bar}>
      <div className={c.barTrack} role="progressbar" aria-valuenow={Math.round(barFrac * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className={c.barFill} data-warn={warn} style={{ width: `${expired ? 100 : barFrac * 100}%` }} />
      </div>
      <div className={c.barText} data-warn={warn}>
        <span>{t.remain} {expired ? '0m' : durTxt(Math.max(0, remain!))}</span>
        <span className={c.barMuted}>·</span>
        <span className={c.barMuted}>{t.expireAt} {stamp(o.rentalEnd!)}</span>
      </div>
      {!ondemand && !expired && <p className={c.barNote}>{t.noStop}</p>}
    </div>}

    {!destroyed && <div className={c.actions}>
      {canOpen
        ? <a className={c.actBtn} data-primary="" href={WORKSPACE_URL} target="_blank" rel="noopener noreferrer"><Icon name="diagonal" size={12} />{t.open}</a>
        : <button type="button" className={c.actBtn} data-primary="" disabled title={t.openHint}><Icon name="diagonal" size={12} />{t.open}</button>}
      {runningLike && <button type="button" className={c.actBtn} onClick={() => onInfo({ kind: 'ssh', id: o.id })}><Icon name="term" size={13} />{t.ssh}</button>}
      {o.status === 'Running' && <button type="button" className={c.actBtn} onClick={() => act.reboot(o.id)}><Icon name="refresh" size={13} />{t.reboot}</button>}
      {ondemand && (o.status === 'Running' || o.status === 'Offline') && <button type="button" className={c.actBtn} onClick={() => act.stop(o.id)}><Icon name="stop" size={12} />{t.stop}</button>}
      {o.status === 'Inactive' && <button type="button" className={c.actBtn} data-kind="start" onClick={() => act.start(o.id)}><Icon name="play" size={12} />{t.start}</button>}
      {expired && <button type="button" className={c.actBtn} disabled title={t.expiredStartTip}><Icon name="play" size={12} />{t.start}</button>}
      <button type="button" className={c.actBtn} onClick={() => onInfo({ kind: 'logs', id: o.id })}><Icon name="term" size={12} />{t.logs}</button>
      {o.ip && !isReserved && <button type="button" className={c.actBtn} onClick={() => onInfo({ kind: 'ports', id: o.id })}><Icon name="port" size={12} />{t.ports}</button>}
      {!confirmOpen
        ? <button type="button" className={c.actBtn} data-kind="danger" onClick={() => onConfirmOpen(o.id)}><Icon name="trash" size={12} />{isReserved ? t.reserveCancelBtn : t.destroy}</button>
        : <div className={c.confirm}>
          <span>{confirmText}</span>
          <button type="button" className={c.confirmBtn} onClick={() => act.destroy(o.id)}>{confirmBtn}</button>
          <button type="button" className={c.confirmCancel} onClick={() => onConfirmOpen(null)}>{t.cancel}</button>
        </div>}
    </div>}

    {o.status === 'Offline' && <div className={c.alert} data-tone="bad">{t.alertOffline}</div>}
    {o.debtStopped && <div className={c.alert} data-tone="warn">{t.debtHint}</div>}
    {expired && <div className={c.alert} data-tone="bad">{t.alertExpired}</div>}
  </article>
}

/* SSH / 端口 / 日志：信息弹窗，外壳复用资金页 Overlay（Escape + 外点关闭） */
function InfoModal({ kind, o, lang, t, onClose }: {
  kind: 'ssh' | 'ports' | 'logs'
  o: OrderRow
  lang: Language
  t: Copy
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const cmd = `ssh ubuntu@${o.ip} -p ${o.port22}`
  const copyCmd = () => {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => { /* 同上：非安全上下文时命令仍可手动选择复制 */ })
  }
  const logLines = Array.from({ length: 8 }, (_, i) => {
    const at = Date.now() - i * 37000
    const seed = [...o.id].reduce((a, ch) => a + ch.charCodeAt(0), 0)
    const util = Math.round(60 + 35 * Math.sin(at / 83000 + seed))
    return `${stamp(at)} [${o.id.slice(-8)}] heartbeat ok · gpu_util ${util}%`
  })

  return <Overlay lang={lang} onClose={onClose} label={kind === 'ssh' ? t.sshTitle(o.machine) : kind === 'ports' ? t.portsTitle(o.machine) : t.logsTitle(o.machine)}>
    <div className={u.head}><h2>{kind === 'ssh' ? t.sshTitle(o.machine) : kind === 'ports' ? t.portsTitle(o.machine) : t.logsTitle(o.machine)}</h2></div>
    <div className={u.body}>
      {kind === 'ssh' && <>
        <pre className={c.sshCmd}>{cmd}</pre>
        <ul className={c.sshNotes}>
          <li>{t.sshNote1}</li>
          <li>{t.sshNote2}</li>
        </ul>
      </>}
      {kind === 'ports' && <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>{t.portsExt}</th><th>{t.portsInt}</th><th className={s.right}>{t.portsUse}</th></tr></thead>
          <tbody>
            <tr><td className={u.mono}>{o.ip}:{o.port22}</td><td className={u.mono}>22/tcp</td><td className={s.right}>{t.useSsh}</td></tr>
            <tr><td className={u.mono}>{o.ip}:{o.port8080}</td><td className={u.mono}>8080/tcp</td><td className={s.right}>{o.launchMode === 'jupyter' ? t.jupyter : t.useHttp}</td></tr>
            {o.customPorts.map(p => <tr key={p}><td className={u.mono}>{o.ip}:{p}</td><td className={u.mono}>{p}/tcp</td><td className={s.right}>{t.useCustom}</td></tr>)}
          </tbody>
        </table>
      </div>}
      {kind === 'logs' && <pre className={c.logLines}>{logLines.join('\n')}</pre>}
    </div>
    <div className={u.foot}>
      {kind === 'ssh' && <button type="button" className={c.copyBtn} onClick={copyCmd}><Icon name="term" size={12} />{copied ? t.copied : t.copy}</button>}
      <button type="button" className={u.btnGhost} onClick={onClose}>{t.close}</button>
    </div>
  </Overlay>
}
