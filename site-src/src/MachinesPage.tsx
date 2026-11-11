/* ============================================================================
   THESIS  宿主机器页是「供给调度台」，不是资产清单：宿主只有四个决策
           （上架/下架、定价、维护窗口、扩容），其余都是支撑信息。页面据此
           只回答三件事——在架多少算力在赚钱、哪台在空转、我的价在市场什么位置。
   OWN-WORLD  与「实例」页同一套控制台外壳：深色 header + 白底 `.page/.shell`
           （复用 WalletPage.module.css），页头一行吸顶标题 + 等宽摘要 + 筛选。
           卡片沿用算力市场的盘口语法（身份行 / 数据行 / 价格列）。
   STORY  机器先归属账号（登记），才能挂牌；上架只从「名下未挂牌」的机器里挑，
           不凭空造机器。挂牌 → 被租用（租约到期回到空闲）→ 空转即待办 →
           调价或下架；一个状态只配一个主操作。
   FORM  吸顶页头（标题 + 在架摘要 + 状态筛选 + 上架入口）→ 机器卡片（空闲优先）
           → 上架选择器 / 调价弹窗。卡片只呈现一次信息，不设「更多参数」：
           本页所有字段折叠态已经给全，再展开只会重复自己。
   ========================================================================== */

import { useState } from 'react'
import type { Language } from './content'
import { regions } from './content'
import Icon from './Icons'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { money, stampFull } from './wallet/store'
import { Overlay } from './wallet/ui'
import u from './wallet/ui.module.css'
import w from './WalletPage.module.css'
import s from './MachinesPage.module.css'
import { HOST_MACHINES, machineView } from './hostMachines'
import type { HostMachine, MachineView } from './hostMachines'
import { useHost } from './hostStore'

type MachineState = 'running' | 'idle' | 'off'
type MachineFilter = 'all' | MachineState
const FILTERS: MachineFilter[] = ['all', 'running', 'idle', 'off']

const DAY = 86400000
const HOUR = 3600000

/* 租约剩余：天数优先，48 小时内精确到小时；不显示秒，避免快照读起来像实时倒计时 */
function dur(ms: number, lang: Language) {
  if (!(ms > 0)) return lang === 'zh' ? '0 小时' : '0h'
  const hours = Math.floor(ms / HOUR), days = Math.floor(hours / 24), rest = hours % 24
  if (lang === 'zh') return days ? `${days} 天${rest ? ` ${rest} 小时` : ''}` : `${hours} 小时`
  return days ? `${days}d${rest ? ` ${rest}h` : ''}` : `${hours}h`
}

const copy = {
  zh: {
    title: '我的机器',
    perHour: '/ 小时',
    summary: (listed: number, total: number, cards: number, rate: string) => `${total} 台 · 在架 ${listed} 台 · ${cards} 张卡 · 在租时价 ${rate}/h`,
    statusRunning: '出租中',
    statusIdle: '空闲',
    statusOff: '未上架',
    filterLabel: '按状态筛选',
    filterAll: '全部',
    filterRunning: '出租中',
    filterIdle: '空闲',
    filterOff: '未上架',
    empty: '还没有机器。',
    emptyFilter: '没有符合这个状态的机器。',
    device: '设备',
    location: '所在地',
    processor: '处理器',
    memory: '内存',
    disk: '存储',
    bandwidth: '带宽',
    vcpu: 'vCPU',
    lease: '租赁状态',
    noLease: '当前无租约',
    onMarketFor: (days: number) => `在架 ${days} 天`,
    justListed: '刚刚上架',
    expireLabel: '到期',
    remain: '剩余',
    offState: '未在市场上架',
    offNote: '上架后按当前挂牌价对外',
    listing: '挂牌价',
    perCard: '每卡',
    market: '同型号中位',
    deltaUnder: (pct: number) => `低于中位 ${pct}%`,
    deltaOver: (pct: number) => `高于中位 ${pct}%`,
    deltaSame: '与中位持平',
    reprice: '调价',
    unlist: '下架',
    list: '上架',
    cancel: '取消',
    confirmUnlist: '下架后不再出现在市场，进行中的租约不受影响。',
    confirmUnlistBtn: '确认下架',
    lockedHint: '租约结束前不可调价或下架',
    listMachine: '上架机器',
    addTitle: '上架机器',
    addLead: '选择一台未挂牌的机器出租，并为其定价。',
    pickLabel: '选择机器',
    verifiedTitle: '已核验配置',
    gpuModel: '卡型',
    addEmpty: '名下机器都已上架。',
    suggestedPrice: '建议整机价',
    priceScopeNote: '整机一口价计费；带宽由平台统一费率计收，不含在本价。',
    priceLabel: '挂牌价（整机 / 小时）',
    listed: (id: string) => `${id} 已上架`,
    demoLabel: '演示',
    demoNote: '机器与租约为演示快照，名下机器由平台接入流程登记；上架、调价与下架只在本账号内生效，不改写已成交的租约。',
    marketMedian: '同型号中位价',
    marketRange: '市场价区间',
    currentPrice: '当前挂牌',
    newPrice: '新挂牌价（整机 / 小时）',
    repriceTitle: (id: string) => `调价 · ${id}`,
    repriceLead: '挂牌价决定新租约的成交价；进行中的租约按原价结算。',
    preview: (perCard: string, delta: string) => `每卡 ${perCard} · ${delta}`,
    invalid: '请输入大于 0 的价格',
    save: '保存',
    saved: (id: string, price: string) => `${id} 挂牌价已更新为 ${price} / 小时`,
  },
  en: {
    title: 'Machines',
    perHour: '/ hr',
    summary: (listed: number, total: number, cards: number, rate: string) => `${total} machines · ${listed} listed · ${cards} GPUs · rented at ${rate}/hr`,
    statusRunning: 'Rented',
    statusIdle: 'Idle',
    statusOff: 'Off market',
    filterLabel: 'Filter by status',
    filterAll: 'All',
    filterRunning: 'Rented',
    filterIdle: 'Idle',
    filterOff: 'Off market',
    empty: 'No machines yet.',
    emptyFilter: 'No machines with this status.',
    device: 'Device',
    location: 'Location',
    processor: 'Processor',
    memory: 'Memory',
    disk: 'Storage',
    bandwidth: 'Bandwidth',
    vcpu: 'vCPU',
    lease: 'Lease',
    noLease: 'No active lease',
    onMarketFor: (days: number) => `On market ${days} days`,
    justListed: 'Listed just now',
    expireLabel: 'Ends',
    remain: 'Remaining',
    offState: 'Not listed on the market',
    offNote: 'Listing uses the current price',
    listing: 'Listing price',
    perCard: 'per GPU',
    market: 'model median',
    deltaUnder: (pct: number) => `${pct}% below median`,
    deltaOver: (pct: number) => `${pct}% above median`,
    deltaSame: 'At the median',
    reprice: 'Reprice',
    unlist: 'Unlist',
    list: 'List',
    cancel: 'Cancel',
    confirmUnlist: 'Unlisting hides the machine from the market; running leases are unaffected.',
    confirmUnlistBtn: 'Unlist',
    lockedHint: 'Repricing and unlisting unlock when the lease ends',
    listMachine: 'List a machine',
    addTitle: 'List a machine',
    addLead: 'Pick an unlisted machine and set its price.',
    pickLabel: 'Machine',
    verifiedTitle: 'Verified specs',
    gpuModel: 'GPUs',
    addEmpty: 'All your machines are already listed.',
    suggestedPrice: 'Suggested machine price',
    priceScopeNote: "One flat machine price; bandwidth is billed at the platform's uniform rate, not part of this price.",
    priceLabel: 'Listing price (machine / hour)',
    listed: (id: string) => `${id} is listed`,
    demoLabel: 'Demo',
    demoNote: 'Machines and leases are a demo snapshot; machines appear here after platform onboarding registers them. Listing, repricing and unlisting apply to this account only and never rewrite a signed lease.',
    marketMedian: 'Model median price',
    marketRange: 'Market price range',
    currentPrice: 'Current listing',
    newPrice: 'New listing price (machine / hour)',
    repriceTitle: (id: string) => `Reprice · ${id}`,
    repriceLead: 'The listing price sets the rate for new leases; running leases settle at the signed price.',
    preview: (perCard: string, delta: string) => `${perCard} per GPU · ${delta}`,
    invalid: 'Enter a price greater than 0',
    save: 'Save',
    saved: (id: string, price: string) => `${id} listing price updated to ${price} / hr`,
  },
}

type Copy = typeof copy['zh']
const STATE_TONE: Record<MachineState, 'ok' | 'muted'> = { running: 'ok', idle: 'muted', off: 'muted' }

/* 相对中位的百分比：四舍五入到 0 就是「持平」，不显示「低于中位 0%」 */
const deltaTextOf = (delta: number, t: Copy) => {
  const pct = Math.round(Math.abs(delta) * 100)
  return pct === 0 ? t.deltaSame : delta < 0 ? t.deltaUnder(pct) : t.deltaOver(pct)
}
const round2 = (value: number) => Math.round(value * 100) / 100

/* 上架建议价：同型号每卡中位 × 卡数；无行情条目的机型回退种子默认价（仅预填，不是报价） */
const suggestPrice = (view: MachineView) => view.market ? view.market * view.count : view.dph

export default function MachinesPage({ lang, account, onSignIn }: {
  lang: Language
  account: Account | null
  onSignIn: (email: string) => void
}) {
  if (!account) return <WalletLocked lang={lang} onSignIn={onSignIn} title={copy[lang].title} />
  return <MachinesAccount key={account.email} lang={lang} email={account.email} />
}

function MachinesAccount({ lang, email }: { lang: Language; email: string }) {
  const t = copy[lang]
  const { host, setHost } = useHost(email)
  const [filter, setFilter] = useState<MachineFilter>('all')
  const [repriceId, setRepriceId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  /* 卡片「上架」只负责选中并打开上架弹窗（预选该机器），与页头入口走同一条定价路径 */
  const [preselectId, setPreselectId] = useState<string | null>(null)
  /* 操作反馈用位置承担：最近操作的机器临时置顶（仅本会话，不持久化）；
     文字结果走视觉不可见的 live region，只给读屏用户 */
  const [recent, setRecent] = useState<string[]>([])
  /* 消息只存参数，文案在渲染时按当前语言生成（语言切换后不残留旧语言） */
  const [live, setLive] = useState<null | { kind: 'listed'; id: string } | { kind: 'saved'; id: string; price: string }>(null)

  /* 挂牌状态＝（种子已挂牌 ∪ 上架过）− 下架过；上下架都可逆 */
  const onMarket = (machine: HostMachine) =>
    (machine.listed || host.listed.includes(machine.id)) && !host.unlisted.includes(machine.id)
  const stateOf = (machine: HostMachine): MachineState =>
    !onMarket(machine) ? 'off' : machine.status === 'running' ? 'running' : 'idle'

  /* 最近操作的排最前；其后空闲在前（登记越久越靠前）、出租中按租约剩余升序、未挂牌沉底 */
  const weight: Record<MachineState, number> = { idle: 0, running: 1, off: 2 }
  const rankOf = (id: string) => { const at = recent.indexOf(id); return at === -1 ? Number.MAX_SAFE_INTEGER : at }
  const views = HOST_MACHINES
    .map(machine => machineView(machine, host.prices[machine.id]))
    .sort((a, b) => {
      const byRecent = rankOf(a.id) - rankOf(b.id)
      if (byRecent) return byRecent
      const byState = weight[stateOf(a)] - weight[stateOf(b)]
      if (byState) return byState
      if (stateOf(a) === 'running') return (a.leaseEnd ?? 0) - (b.leaseEnd ?? 0)
      return a.registeredAt - b.registeredAt
    })
  const visible = filter === 'all' ? views : views.filter(view => stateOf(view) === filter)

  const listedViews = views.filter(onMarket)
  const runningViews = listedViews.filter(view => stateOf(view) === 'running')
  const listedCards = listedViews.reduce((sum, view) => sum + view.count, 0)
  const rentedRate = runningViews.reduce((sum, view) => sum + view.dph, 0)
  const offViews = views.filter(view => stateOf(view) === 'off')
  const repriceView = repriceId ? views.find(view => view.id === repriceId) ?? null : null

  const touch = (id: string) => setRecent(prev => [id, ...prev.filter(value => value !== id)])

  const savePrice = (view: MachineView, price: number) => {
    setHost(prev => ({ ...prev, prices: { ...prev.prices, [view.id]: price } }))
    setRepriceId(null)
    touch(view.id)
    setLive({ kind: 'saved', id: view.id, price: money(price) })
  }
  const unlist = (id: string) => {
    setHost(prev => ({ ...prev, unlisted: [...prev.unlisted, id], listed: prev.listed.filter(value => value !== id) }))
    setConfirmId(null)
    touch(id)
  }
  const list = (id: string, price?: number) => {
    setHost(prev => ({
      ...prev,
      listed: [...new Set([...prev.listed, id])],
      unlisted: prev.unlisted.filter(value => value !== id),
      prices: price != null ? { ...prev.prices, [id]: price } : prev.prices,
    }))
    setAdding(false)
    setFilter('all')
    touch(id)
    setLive({ kind: 'listed', id })
  }

  return <div className={w.page}>
    <div className={w.shell}>
      <header className={s.headRow}>
        <h1 className={s.title}>{t.title}</h1>
        <p className={s.summary}>{t.summary(listedViews.length, views.length, listedCards, money(rentedRate))}</p>
        <div className={s.toolbar}>
          <div className={s.filters} role="group" aria-label={t.filterLabel}>
            {FILTERS.map(value => <button key={value} type="button" className={s.chip} data-active={filter === value}
              aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === 'all' ? t.filterAll : value === 'running' ? t.filterRunning : value === 'idle' ? t.filterIdle : t.filterOff}
            </button>)}
          </div>
          <button type="button" className={s.act} data-primary onClick={() => { setPreselectId(null); setAdding(true) }}><Icon name="plus" size={13}/>{t.listMachine}</button>
        </div>
      </header>

      <p className={s.srOnly} role="status">{live && (live.kind === 'listed' ? t.listed(live.id) : t.saved(live.id, live.price))}</p>

      {visible.length === 0 ? <p className={s.empty}>{views.length === 0 ? t.empty : t.emptyFilter}</p> : (
        <div className={s.cards}>
          {visible.map(view => {
            const state = stateOf(view)
            const region = regions.find(item => item.id === view.region)
            const remaining = view.leaseEnd ? view.leaseEnd - Date.now() : 0
            const marketDays = Math.max(0, Math.floor((Date.now() - view.registeredAt) / DAY))
            const deltaText = view.market ? deltaTextOf(view.delta, t) : ''

            return <article key={view.id} className={s.card} data-state={state} aria-label={`${view.count} × ${view.model} ${view.id}`}>
              <header className={s.identity}>
                <div className={s.identityItems}>
                  <span className={s.status} data-tone={STATE_TONE[state]}>
                    {state === 'running' && <span className={s.pulse} aria-hidden="true" />}
                    {state === 'running' ? t.statusRunning : state === 'off' ? t.statusOff : t.statusIdle}
                  </span>
                  <span className={s.identityItem}><span>{t.device}</span><code>{view.id}</code></span>
                  <span className={s.identityItem}><span>{t.location}</span><strong>{region ? region[lang] : view.region.toUpperCase()}</strong>{lang === 'zh' && region && <small className={s.regionEn}>{region.en}</small>}</span>
                </div>
                <div className={s.rowActions}>
                  {confirmId === view.id ? <div className={s.confirmInline} role="group" aria-label={t.unlist}>
                    <span>{t.confirmUnlist}</span>
                    <button type="button" data-kind="danger" onClick={() => unlist(view.id)}>{t.confirmUnlistBtn}</button>
                    <button type="button" onClick={() => setConfirmId(null)}>{t.cancel}</button>
                  </div> : <>
                    {state === 'idle' && <>
                      <button type="button" className={s.act} data-primary onClick={() => setRepriceId(view.id)}>{t.reprice}</button>
                      <button type="button" className={s.act} data-kind="danger" onClick={() => setConfirmId(view.id)}>{t.unlist}</button>
                    </>}
                    {state === 'off' && <>
                      <button type="button" className={s.act} data-kind="start" onClick={() => { setPreselectId(view.id); setAdding(true) }}>{t.list}</button>
                      <button type="button" className={s.act} onClick={() => setRepriceId(view.id)}>{t.reprice}</button>
                    </>}
                  </>}
                </div>
              </header>

              <div className={s.dataRow} data-specs={view.specKnown}>
                <div className={s.gpuCell}>
                  <h2>{view.count} × {view.model}</h2>
                  {view.memory && <p className={s.gpuMemory}>{view.memory}{view.count > 1 && <small> VRAM / {lang === 'zh' ? '卡' : 'GPU'}</small>}</p>}
                </div>

                {/* 未登记配置的机器不排版空值，整组不出（栅格随之收成三列） */}
                {view.specKnown && <>
                  <div className={s.cpuCell}>
                    <div className={s.specBlock}>
                      <h3 className={s.specTitle}>{t.processor}</h3>
                      <div className={s.specValue}>{view.vcpu} {t.vcpu}</div>
                    </div>
                    <div className={s.specBlock}>
                      <h3 className={s.specTitle}>{t.memory}</h3>
                      <div className={s.specValue}>{view.memGb} GB</div>
                    </div>
                  </div>

                  <div className={s.diskCell}>
                    <div className={s.specBlock}>
                      <h3 className={s.specTitle}>{t.disk}</h3>
                      <div className={s.specValue}>{view.diskGb} GB</div>
                    </div>
                    <div className={s.specBlock}>
                      <h3 className={s.specTitle}>{t.bandwidth}</h3>
                      <div className={s.specValue}>↑ {view.bwMbps} Mbps</div>
                    </div>
                  </div>
                </>}

                <div className={s.leaseCell}>
                  <span className={s.cellLabel}>{t.lease}</span>
                  {state === 'running'
                    ? <>
                      <p className={s.leaseMain}>{t.remain} <b>{dur(remaining, lang)}</b></p>
                      <div className={s.cellMuted}>{t.expireLabel} {stampFull(view.leaseEnd ?? 0)}</div>
                      <div className={s.cellMuted}>{t.lockedHint}</div>
                    </>
                    : state === 'off'
                      ? <>
                        <p className={s.leaseMain}>{t.offState}</p>
                        <div className={s.cellMuted}>{t.offNote}</div>
                      </>
                      : <>
                        <p className={s.leaseMain}>{t.noLease}</p>
                        <div className={s.cellMuted}>{marketDays < 1 ? t.justListed : t.onMarketFor(marketDays)}</div>
                      </>}
                </div>

                <div className={s.priceCell}>
                  <span className={s.cellLabel}>{t.listing}</span>
                  <strong>{money(view.dph)}<span className={s.priceUnit}>{t.perHour}</span></strong>
                  <div className={s.priceMeta}>{t.perCard} <b>{money(view.perCard)}</b>{view.market > 0 && <> · {t.market} <b>{money(view.market)}</b></>}</div>
                  {deltaText && <div className={s.priceDelta}>{deltaText}</div>}
                </div>
              </div>
            </article>
          })}
        </div>
      )}

      <div className={s.demoRow}>
        <span className={s.demoLabel}>{t.demoLabel}</span>
        <span className={s.demoNote}>{t.demoNote}</span>
      </div>
    </div>

    {repriceView && <RepriceDialog view={repriceView} lang={lang} t={t} onClose={() => setRepriceId(null)} onSave={price => savePrice(repriceView, price)} />}
    {adding && <ListMachineDialog lang={lang} t={t} candidates={offViews} initialId={preselectId} onClose={() => setAdding(false)} onList={list} />}
  </div>
}

function RepriceDialog({ view, lang, t, onClose, onSave }: {
  view: MachineView
  lang: Language
  t: Copy
  onClose: () => void
  onSave: (price: number) => void
}) {
  const [draft, setDraft] = useState(view.dph.toFixed(2))
  const value = Number(draft)
  const valid = Number.isFinite(value) && value > 0 && value < 1000
  /* 与 machineView 同一取整路径：预览里的每卡价与卡片上的修订结果必须一致 */
  const perCardRaw = valid ? value / view.count : 0
  const perCard = round2(perCardRaw)
  const delta = view.market ? (perCardRaw - view.market) / view.market : 0

  return <Overlay lang={lang} onClose={onClose} label={t.repriceTitle(view.id)}>
    <div className={u.head}>
      <h2>{t.repriceTitle(view.id)}</h2>
      <p>{t.repriceLead}</p>
    </div>
    <div className={u.body}>
      <div className={s.marketBox}>
        <div className={s.marketRow}><span>{t.marketMedian}</span><b>{view.market ? `${t.perCard} ${money(view.market)}` : '—'}</b></div>
        <div className={s.marketRow}><span>{t.marketRange}</span><b>{view.range ? `${money(view.range[0])} – ${money(view.range[1])}` : '—'}</b></div>
        <div className={s.marketRow}><span>{t.currentPrice}</span><b>{money(view.dph)} {t.perHour}</b></div>
      </div>
      <label className={u.fieldLabel} htmlFor="reprice-input">{t.newPrice}</label>
      <div className={s.priceField}>
        <em>$</em>
        <input id="reprice-input" type="number" inputMode="decimal" min="0.01" step="0.01" value={draft} autoFocus
          onChange={event => setDraft(event.target.value)} aria-describedby="reprice-preview" aria-invalid={!valid || undefined} />
      </div>
      <p id="reprice-preview" className={s.preview} data-invalid={!valid || undefined} role={valid ? 'status' : 'alert'}>
        {valid ? t.preview(money(perCard), deltaTextOf(delta, t)) : t.invalid}
      </p>
      <p className={s.scopeNote}>{t.priceScopeNote}</p>
    </div>
    <div className={u.foot}>
      <button type="button" className={u.btnGhost} onClick={onClose}>{t.cancel}</button>
      <button type="button" className={u.btnPrimary} disabled={!valid} onClick={() => onSave(round2(value))}>{t.save}</button>
    </div>
  </Overlay>
}

/* 上架：只能从「名下未挂牌」的机器里挑，型号/卡数/地区都是机器自身的属性，
   这里只决定挂牌价（默认按同型号市场中位 × 卡数预填）。 */
function ListMachineDialog({ lang, t, candidates, initialId, onClose, onList }: {
  lang: Language
  t: Copy
  candidates: MachineView[]
  initialId: string | null
  onClose: () => void
  onList: (id: string, price?: number) => void
}) {
  /* 卡片入口预选发起上架的那台（initialId），页头入口落到第一台 */
  const initialPick = candidates.find(item => item.id === initialId) ?? candidates[0]
  const [picked, setPicked] = useState(initialPick?.id ?? '')
  /* 预填建议价（同型号每卡中位 × 卡数）：未挂牌机器没有「当前价」，价格在点「上架」时才产生 */
  const [draft, setDraft] = useState(() => (initialPick ? suggestPrice(initialPick) : 0).toFixed(2))

  const view = candidates.find(item => item.id === picked)
  const value = Number(draft)
  const valid = Boolean(view) && Number.isFinite(value) && value > 0 && value < 10000
  const perCardRaw = view && valid ? value / view.count : 0
  const perCard = round2(perCardRaw)
  const delta = view?.market ? (perCardRaw - view.market) / view.market : 0

  const pick = (next: MachineView) => {
    setPicked(next.id)
    setDraft(suggestPrice(next).toFixed(2))
  }

  return <Overlay lang={lang} onClose={onClose} label={t.addTitle}>
    <div className={u.head}>
      <h2>{t.addTitle}</h2>
      <p>{t.addLead}</p>
    </div>
    <div className={u.body}>
      {candidates.length === 0 ? <p className={u.note}>{t.addEmpty}</p> : <>
        <label className={s.picker}>
          <span className={u.fieldLabel}>{t.pickLabel}</span>
          <select value={picked} onChange={event => {
            const next = candidates.find(item => item.id === event.target.value)
            if (next) pick(next)
          }}>
            {candidates.map(item => {
              const region = regions.find(entry => entry.id === item.region)
              return <option key={item.id} value={item.id}>{item.count} × {item.model} · {region ? region[lang] : item.region.toUpperCase()} · {item.id}</option>
            })}
          </select>
        </label>

        {/* 平台核验背书：登记配置只读展示（未登记配置的机器整组不出，与机器卡同口径） */}
        {view?.specKnown && (
          <div className={s.verifiedBox} role="group" aria-label={t.verifiedTitle}>
            <div className={s.verifiedHead}><Icon name="check" size={12} /><b>{t.verifiedTitle}</b></div>
            <div className={s.marketRow}><span>{t.gpuModel}</span><b>{view.model} × {view.count}</b></div>
            <div className={s.marketRow}><span>{t.processor}</span><b>{view.vcpu} {t.vcpu}</b></div>
            <div className={s.marketRow}><span>{t.memory}</span><b>{view.memGb} GB</b></div>
            <div className={s.marketRow}><span>{t.disk}</span><b>{view.diskGb} GB</b></div>
            <div className={s.marketRow}><span>{t.bandwidth}</span><b>↑ {view.bwMbps} Mbps</b></div>
            <div className={s.marketRow}><span>{t.location}</span><b>{regions.find(entry => entry.id === view.region)?.[lang] ?? view.region.toUpperCase()}</b></div>
          </div>
        )}

        <div className={s.marketBox}>
          <div className={s.marketRow}><span>{t.marketMedian}</span><b>{view?.market ? `${t.perCard} ${money(view.market)}` : '—'}</b></div>
          <div className={s.marketRow}><span>{t.marketRange}</span><b>{view?.range ? `${money(view.range[0])} – ${money(view.range[1])}` : '—'}</b></div>
          <div className={s.marketRow}><span>{t.suggestedPrice}</span><b>{view ? `${money(suggestPrice(view))} ${t.perHour}` : '—'}</b></div>
        </div>
        <label className={u.fieldLabel} htmlFor="list-price">{t.priceLabel}</label>
        <div className={s.priceField}>
          <em>$</em>
          <input id="list-price" type="number" inputMode="decimal" min="0.01" step="0.01" value={draft}
            onChange={event => setDraft(event.target.value)} aria-describedby="list-preview" aria-invalid={!valid || undefined} />
        </div>
        <p id="list-preview" className={s.preview} data-invalid={!valid || undefined} role={valid ? 'status' : 'alert'}>
          {valid ? t.preview(money(perCard), deltaTextOf(delta, t)) : t.invalid}
        </p>
        <p className={s.scopeNote}>{t.priceScopeNote}</p>
      </>}
    </div>
    <div className={u.foot}>
      <button type="button" className={u.btnGhost} onClick={onClose}>{t.cancel}</button>
      <button type="button" className={u.btnPrimary} disabled={!valid} onClick={() => view && onList(view.id, round2(value))}>{t.list}</button>
    </div>
  </Overlay>
}
