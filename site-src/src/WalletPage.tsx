/* ============================================================================
   THESIS  租户资金页回答：余额多少、怎么充、花了哪些订单、钱怎么进出。
           一个 USD 余额；银行卡与 USDT 只是入金方式，不是两个钱包。
   OWN-WORLD  白底，复用算力市场白区色板：#fff / #17212c / #34475a / #627386 /
           #315f90 / #dce2e8、#e1e6ec；深色 header 由 App 层保留。
   STORY  充值入余额 → 租卡直接从余额扣款 → 未消费部分按来源退出：
           卡充值原路退款、USDT 充值提到链上钱包。退款按支付单算额度与截止日。
   FORM  余额卡（金额 + 充值/退回）→ 消费构成 → 退回记录 → 资金流水。
   ========================================================================== */

import { Fragment, useEffect, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { applyExitAdvance, applyExitSubmit, applyTopup, cryptoWithdrawable, exitNo, money, refundable, stamp, stampFull, usdt, useWallet } from './wallet/store'
import type { ExitRequest, ExitStatus, LedgerRow, WalletState } from './wallet/store'
import { asOfAt, fmtDuration, monthComposition, rollingPending, usageBreakdown } from './wallet/usage'
import { TopupFlow } from './wallet/Topup'
import { ExitModal, exitStageLabel } from './wallet/Withdraw'
import { Badge, PageNav } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './WalletPage.module.css'

const EXITS_PAGE = 5
const LEDGER_PAGE = 8

type LedgerFilter = 'all' | 'topup' | 'consume' | 'exit'

/* 链上地址截断展示（头 6 尾 6）；完整地址进 title。 */
const shortAddr = (a?: string) =>
  a ? (a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a) : '—'

const copy = {
  zh: {
    title: '资金',
    balance: 'USD 余额',
    topup: '充值',
    refund: '退回',
    amount: '金额',
    status: '状态',
    no: '单号',
    exits: '退回记录',
    noExits: '还没有退回记录',
    methodCol: '方式',
    methodRefund: '退回银行卡',
    methodWithdraw: '提到钱包',
    payRef: '支付单',
    demoAdvance: '演示推进',
    advanceStart: '开始处理',
    advanceDone: '标记完成',
    advanceFail: '标记失败',
    ledger: '资金流水',
    ledgerLead: '余额列为该笔之后的余额。',
    time: '时间',
    requestedAt: '申请时间',
    desc: '说明',
    poolBalance: '余额',
    noLedger: '暂无流水',
    descTopup: '充值入账',
    descConsume: '租卡扣款',
    descPenalty: '提前取消违约金',
    descRefund: '退回银行卡',
    descRefundInto: '退回余额',
    descWithdraw: '提到钱包',
    coinIn: (v: string) => `实付 ${v}`,
    coinOut: (v: string, f: string) => `到账 ${v} · 费 ${f}`,
    filterAll: '全部',
    filterTopup: '充值',
    filterConsume: '租卡扣款',
    filterExit: '退回',
    total: (n: number) => `共 ${n} 条`,
    prev: '上一页',
    next: '下一页',
    pageOf: (i: number, n: number) => `第 ${i} / ${n} 页`,
    pagination: '分页',
    toastTopup: (v: string) => `已充值 ${v}`,
    toastRefund: '退款已提交，将原路退回',
    toastWithdraw: '提现已提交，到账金额以通道报价为准',
    toastFailed: '未成功，金额已解冻',
    toastDone: (v: string) => `${v} 已处理完成`,
    toastAbnormal: '异常支付已原链退回，未计入余额',
    usage: '消费构成',
    asOf: (s: string) => `用量数据截至 ${s}`,
    rolling: (v: string) => `运行中实例含未落账 ${v}`,
    compGpu: 'GPU 算力',
    compBw: '带宽',
    compStorage: '停机存储',
    compTotal: '合计',
    compEmpty: '暂无消费',
    proofBtn: '用量依据',
    proofGpu: 'GPU 费',
    proofBw: '带宽费',
    proofStorage: '停机存储费',
    proofDuration: '计费时长',
    proofBwCap: '固定带宽',
    proofDisk: '磁盘',
    proofSegs: '最近用量段',
    segId: '段',
    segState: '计量',
    segDur: '时长',
    segBw: '带宽',
    stateRun: '运行',
    stateStop: '关机',
  },
  en: {
    title: 'Funds',
    balance: 'USD balance',
    topup: 'Top up',
    refund: 'Refund',
    amount: 'Amount',
    status: 'Status',
    no: 'Reference',
    exits: 'Refund & withdrawal history',
    noExits: 'Nothing returned yet',
    methodCol: 'Method',
    methodRefund: 'To the card',
    methodWithdraw: 'To a wallet',
    payRef: 'Payment',
    demoAdvance: 'Demo controls',
    advanceStart: 'Start',
    advanceDone: 'Mark done',
    advanceFail: 'Mark failed',
    ledger: 'Ledger',
    ledgerLead: 'The balance column is the balance after that entry.',
    time: 'Time',
    requestedAt: 'Requested',
    desc: 'Description',
    poolBalance: 'Balance',
    noLedger: 'No entries yet',
    descTopup: 'Top-up credited',
    descConsume: 'Rental charge',
    descPenalty: 'Early cancellation penalty',
    descRefund: 'Refunded to card',
    descRefundInto: 'Refunded to balance',
    descWithdraw: 'Withdrawn to wallet',
    coinIn: (v: string) => `Paid ${v}`,
    coinOut: (v: string, f: string) => `Received ${v} · fee ${f}`,
    filterAll: 'All',
    filterTopup: 'Top-ups',
    filterConsume: 'Rental charges',
    filterExit: 'Returned',
    total: (n: number) => `${n} entries`,
    prev: 'Previous',
    next: 'Next',
    pageOf: (i: number, n: number) => `Page ${i} of ${n}`,
    pagination: 'Pagination',
    toastTopup: (v: string) => `${v} credited`,
    toastRefund: 'Refund submitted; it goes back to the original card',
    toastWithdraw: 'Withdrawal submitted; the amount received is quoted by the channel',
    toastFailed: 'Not completed; the amount is released',
    toastDone: (v: string) => `${v} completed`,
    toastAbnormal: 'Abnormal payment refunded on chain, not credited',
    usage: 'Spend breakdown',
    asOf: (s: string) => `Usage data as of ${s}`,
    rolling: (v: string) => `Running instances include ${v} not yet posted`,
    compGpu: 'GPU compute',
    compBw: 'Bandwidth',
    compStorage: 'Idle storage',
    compTotal: 'Total',
    compEmpty: 'No spend yet',
    proofBtn: 'Usage evidence',
    proofGpu: 'GPU',
    proofBw: 'Bandwidth',
    proofStorage: 'Idle storage',
    proofDuration: 'Billed duration',
    proofBwCap: 'Fixed bandwidth',
    proofDisk: 'Disk',
    proofSegs: 'Latest usage segments',
    segId: 'Segment',
    segState: 'Meter',
    segDur: 'Duration',
    segBw: 'Bandwidth',
    stateRun: 'Running',
    stateStop: 'Stopped',
  },
}

export default function WalletPage({ lang, account, onSignIn }: {
  lang: Language
  account: Account | null
  onSignIn: (email: string) => void
}) {
  if (!account) return <WalletLocked lang={lang} onSignIn={onSignIn} title={copy[lang].title} />
  return <WalletAccount key={account.email} lang={lang} email={account.email} />
}

function WalletAccount({ lang, email }: { lang: Language; email: string }) {
  const t = copy[lang]
  const { wallet, setWallet } = useWallet(email)
  const [toast, setToast] = useState<string | null>(null)
  const [topupOpen, setTopupOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [exitsPage, setExitsPage] = useState(1)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [proofOpen, setProofOpen] = useState<Set<string>>(new Set())

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id) }, [toast])
  const flash = (msg: string) => setToast(msg)

  const refundTotal = refundable(wallet)
  const withdrawTotal = cryptoWithdrawable(wallet)
  const inFlight = wallet.exits.filter(r => r.status === 'pending' || r.status === 'processing')
  const canExit = refundTotal + withdrawTotal > 0.004

  const creditByChannel = (amount: number, channel: 'card' | 'crypto') => {
    setWallet((prev: WalletState) => applyTopup(prev, channel, amount))
    flash(t.toastTopup(money(amount)))
    setTopupOpen(false)
  }

  const submitRefund = (paymentId: string, amount: number) => {
    setWallet((prev: WalletState) => applyExitSubmit(prev, 'refund', amount, { paymentId }) ?? prev)
    flash(t.toastRefund)
  }
  const submitWithdraw = (amount: number, address: string) => {
    setWallet((prev: WalletState) => applyExitSubmit(prev, 'withdraw', amount, { address }) ?? prev)
    flash(t.toastWithdraw)
  }
  const advance = (req: ExitRequest, to: ExitStatus) => {
    setWallet((prev: WalletState) => applyExitAdvance(prev, req.id, to))
    if (to === 'failed') flash(t.toastFailed)
    else if (to === 'done') flash(t.toastDone(money(req.amount)))
  }

  const desc = (row: LedgerRow) =>
    row.kind === 'topup' ? `${t.descTopup}${row.channel ? ` · ${row.channel === 'card' ? (lang === 'zh' ? '银行卡' : 'Card') : 'USDT'}` : ''}`
      : row.kind === 'consume' ? t.descConsume
        : row.kind === 'penalty' ? t.descPenalty
          : row.kind === 'refund' ? (row.into ? t.descRefundInto : t.descRefund)
          : row.kind === 'withdraw' ? t.descWithdraw : ''

  const tenantLedger = wallet.ledger
  const ledgerRows = ledgerFilter === 'all'
    ? tenantLedger
    : ledgerFilter === 'exit'
      ? tenantLedger.filter(row => row.kind === 'refund' || row.kind === 'withdraw')
      : tenantLedger.filter(row => row.kind === ledgerFilter)
  const exitPages = Math.max(1, Math.ceil(wallet.exits.length / EXITS_PAGE))
  const safeExitsPage = Math.min(exitsPage, exitPages)
  const visibleExits = wallet.exits.slice((safeExitsPage - 1) * EXITS_PAGE, safeExitsPage * EXITS_PAGE)
  const ledgerPages = Math.max(1, Math.ceil(ledgerRows.length / LEDGER_PAGE))
  const safeLedgerPage = Math.min(ledgerPage, ledgerPages)
  const visibleLedger = ledgerRows.slice((safeLedgerPage - 1) * LEDGER_PAGE, safeLedgerPage * LEDGER_PAGE)
  const changeFilter = (next: LedgerFilter) => { setLedgerFilter(next); setLedgerPage(1) }
  const toggleProof = (id: string) => setProofOpen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const comp = monthComposition(wallet)
  const rolling = rollingPending(wallet)
  const compPct = (v: number) => comp.total > 0 ? `${Math.max(1, Math.round(v / comp.total * 100))}%` : '0%'

  return <div className={s.page}>
    <div className={s.shell}>
      <header className={s.head}>
        <h1>{t.title}</h1>
      </header>

      <section className={s.pools} aria-label={t.balance}>
        <article className={s.pool}>
          <header className={s.poolHead}>
            <span className={s.poolMark} aria-hidden="true" />
            <div className={s.poolIdentity}>
              <span className={s.poolVendor}>{t.balance}</span>
            </div>
          </header>
          <div className={s.poolFoot}>
            <strong className={s.poolAmount}>{money(wallet.balance)}</strong>
            <div className={s.poolActions}>
              <button className={u.btnGhost} disabled={!canExit || inFlight.length > 0} onClick={() => setExitOpen(true)}>{t.refund}</button>
              <button className={u.btnPrimary} onClick={() => setTopupOpen(true)}>{t.topup}</button>
            </div>
          </div>
        </article>
      </section>

      <section className={s.section} aria-labelledby="wallet-usage-title">
        <div className={s.sectionHead}>
          <h2 id="wallet-usage-title">{t.usage}</h2>
          <p className={s.asof}>{t.asOf(stamp(asOfAt(wallet)))}</p>
        </div>
        {!comp.hasRows ? <p className={s.empty}>{t.compEmpty}</p> : (
          <div className={s.usageBody}>
            <div className={s.usageBar} role="img" aria-label={`${t.usage} ${money(comp.total)}`}>
              {([['gpu', comp.gpu], ['bw', comp.bw], ['storage', comp.storage]] as Array<[string, number]>).map(([k, v]) =>
                v > 0.005 && <span key={k} data-k={k} style={{ flexGrow: v }} />)}
            </div>
            <ul className={s.usageLegend}>
              <li><span className={s.dot} data-k="gpu" aria-hidden="true" />{t.compGpu}<b className={u.mono}>{money(comp.gpu)}</b><span className={s.legendPct}>{compPct(comp.gpu)}</span></li>
              <li><span className={s.dot} data-k="bw" aria-hidden="true" />{t.compBw}<b className={u.mono}>{money(comp.bw)}</b><span className={s.legendPct}>{compPct(comp.bw)}</span></li>
              <li><span className={s.dot} data-k="storage" aria-hidden="true" />{t.compStorage}<b className={u.mono}>{money(comp.storage)}</b><span className={s.legendPct}>{compPct(comp.storage)}</span></li>
              <li className={s.legendTotal}>{t.compTotal}<b className={u.mono}>{money(comp.total)}</b></li>
            </ul>
            {rolling > 0 && <p className={s.rollingNote}>{t.rolling(money(rolling))}</p>}
          </div>
        )}
      </section>

      <section className={s.section} aria-labelledby="wallet-exits-title">
        <div className={s.sectionHead}>
          <h2 id="wallet-exits-title">{t.exits}</h2>
        </div>
        {wallet.exits.length === 0 ? <p className={s.empty}>{t.noExits}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr>
                <th>{t.no}</th><th>{t.requestedAt}</th><th>{t.methodCol}</th><th className={s.right}>{t.amount}</th>
                <th>{t.status}</th><th className={s.right}>{t.demoAdvance}</th>
              </tr></thead>
              <tbody>
                {visibleExits.map(req => {
                  const stage = exitStageLabel(lang, req)
                  const actions: Array<[string, ExitStatus]> = req.status === 'pending'
                    ? [[t.advanceStart, 'processing'], [t.advanceFail, 'failed']]
                    : req.status === 'processing'
                      ? [[t.advanceDone, 'done'], [t.advanceFail, 'failed']]
                      : []
                  return <tr key={req.id}>
                    <td className={u.mono}>{exitNo(req)}</td>
                    <td className={u.mono}>{stampFull(req.at)}</td>
                    <td>{req.method === 'refund' ? t.methodRefund : t.methodWithdraw}
                      {/* 收款去向：退款＝原路退回，附支付单引用；提现＝链上地址（截断） */}
                      <span className={s.methodSub} title={req.method === 'refund' ? undefined : req.address}>
                        {req.method === 'refund'
                          ? `${t.payRef} ${req.allocations[0]?.paymentId ?? '—'}${req.allocations.length > 1 ? ` +${req.allocations.length - 1}` : ''}`
                          : shortAddr(req.address)}
                      </span>
                    </td>
                    <td className={`${s.right} ${u.mono}`}>{money(req.amount)}</td>
                    <td><Badge tone={stage.tone}>{stage.label}</Badge></td>
                    <td className={s.right}><div className={s.advanceRow}>{actions.length === 0 ? '—' : actions.map(([label, to]) =>
                      <button key={to} className={u.miniBtn} onClick={() => advance(req, to)}>{label}</button>)}</div></td>
                  </tr>
                })}
              </tbody>
            </table>
            <PageNav page={safeExitsPage} pages={exitPages} count={wallet.exits.length} t={t}
              onPage={next => setExitsPage(Math.min(Math.max(next, 1), exitPages))} />
          </div>
        )}
      </section>

      <section className={s.section} aria-labelledby="wallet-ledger-title">
        <div className={s.sectionHead}>
          <h2 id="wallet-ledger-title">{t.ledger}</h2>
          <p>{t.ledgerLead}</p>
          <div className={s.filters} role="group" aria-label={t.ledger}>
            {([['all', t.filterAll], ['topup', t.filterTopup], ['consume', t.filterConsume], ['exit', t.filterExit]] as Array<[LedgerFilter, string]>).map(([key, label]) =>
              <button key={key} type="button" className={s.filter} data-active={ledgerFilter === key} aria-pressed={ledgerFilter === key}
                onClick={() => changeFilter(key)}>{label}</button>)}
          </div>
        </div>
        {ledgerRows.length === 0 ? <p className={s.empty}>{t.noLedger}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>{t.time}</th><th>{t.desc}</th><th className={s.right}>{t.amount}</th><th className={s.right}>{t.poolBalance}</th></tr></thead>
              <tbody>{visibleLedger.map(row => {
                const bd = row.kind === 'consume' ? usageBreakdown(row) : null
                const open = proofOpen.has(row.id)
                return <Fragment key={row.id}>
                  <tr>
                    <td className={u.mono}>{stampFull(row.at)}</td>
                    <td><span className={s.descWrap}>{desc(row)}
                      {row.coin && <span className={s.descLabel}>{row.coin.fee !== undefined ? t.coinOut(usdt(row.coin.amount), usdt(row.coin.fee)) : t.coinIn(usdt(row.coin.amount))}</span>}
                      {row.label && <span className={s.descLabel}>{row.label}</span>}
                      {bd && <button type="button" className={s.proofBtn} aria-expanded={open}
                        aria-controls={`proof-${row.id}`} onClick={() => toggleProof(row.id)}>{t.proofBtn}</button>}
                    </span></td>
                    <td className={`${s.right} ${u.mono}`}>{row.kind === 'topup' || row.into ? '+' : '-'}{money(row.amount)}</td>
                    <td className={`${s.right} ${u.mono}`}>{row.balAfter === undefined ? '—' : money(row.balAfter)}</td>
                  </tr>
                  {open && bd && <tr id={`proof-${row.id}`} className={s.proofRow}>
                    <td colSpan={4}>
                      <div className={s.proofPanel}>
                        <div className={s.proofGrid}>
                          {bd.kind === 'gpu' ? <>
                            <span><span className={s.proofLabel}>{t.proofGpu}</span><b>{money(bd.gpuFee)}</b></span>
                            <span><span className={s.proofLabel}>{t.proofBw}</span><b>{money(bd.bwFee)}</b></span>
                          </> : <>
                            <span><span className={s.proofLabel}>{t.proofStorage}</span><b>{money(bd.storageFee)}</b></span>
                            <span><span className={s.proofLabel}>{t.proofDisk}</span><b>{bd.diskGb} GB</b></span>
                          </>}
                          <span><span className={s.proofLabel}>{t.proofDuration}</span><b>{fmtDuration(bd.seconds)}</b></span>
                          <span><span className={s.proofLabel}>{t.proofBwCap}</span><b>{bd.bwMbps} Mbps</b></span>
                        </div>
                        <div>
                          <p className={s.proofSegsTitle}>{t.proofSegs}</p>
                          <table className={s.segTable}>
                            <thead><tr><th>{t.segId}</th><th>{t.segState}</th><th className={s.right}>{t.segDur}</th><th className={s.right}>{t.segBw}</th></tr></thead>
                            <tbody>{bd.segments.map(seg => <tr key={seg.id}>
                              <td>{seg.id}</td>
                              <td><span className={s.segPill} data-run={seg.state === 'running'}>{seg.state === 'running' ? t.stateRun : t.stateStop}</span></td>
                              <td className={s.right}>{fmtDuration(seg.durationSeconds)}</td>
                              <td className={s.right}>{seg.bandwidthMbps} Mbps</td>
                            </tr>)}</tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>}
                </Fragment>
              })}</tbody>
            </table>
            <PageNav page={safeLedgerPage} pages={ledgerPages} count={ledgerRows.length} t={t}
              onPage={next => setLedgerPage(Math.min(Math.max(next, 1), ledgerPages))} />
          </div>
        )}
      </section>
    </div>

    {topupOpen && <TopupFlow lang={lang} onClose={() => setTopupOpen(false)}
      onCredit={(amount, channel) => creditByChannel(amount, channel)}
      onRefund={() => { flash(t.toastAbnormal); setTopupOpen(false) }} />}

    {exitOpen && <ExitModal lang={lang} wallet={wallet}
      onClose={() => setExitOpen(false)}
      onRefund={submitRefund}
      onWithdraw={submitWithdraw} />}

    {toast && <div className={u.toast} role="status">{toast}</div>}
  </div>
}
