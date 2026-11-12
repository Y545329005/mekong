/* ============================================================================
   THESIS  宿主收益页回答：现在能结算多少、多少还在待结算、近 30 天赚了多少、
           结算走到哪一步。主语是收益，不展示租户余额，不做充值。
   OWN-WORLD  白底，与算力市场白区同一套值（#fff/#17212c/#34475a/#627386/
           #315f90/#dce2e8、#e1e6ec）；深色 header 由 App 层保留。等宽数字。
   STORY  收益先进待结算（结算 + 争议窗口），到期转可结算；提交结算申请后
           走平台审批六态（待审→放行→出款→到账），记录见结算记录表。
           企业宿主走线下，不进入本页。
   FORM  收益卡（规则并入卡内）→ 结算记录 → 收益明细（30 天汇总块 + 分页）→ 演示层。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { applyAccrue, applyHoldUnlock, applySettleSubmit, earnings30d, money, settleable, settleInFlight, settleNo, stampFull, useWallet } from './wallet/store'
import type { LedgerRow, SettleRequest, SettleStatus, WalletState } from './wallet/store'
import { readRate } from './adminStore'
import { Badge, PageNav } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './EarningsPage.module.css'

const EARN_PAGE = 8

const copy = {
  zh: {
    title: '收益',
    balance: '可结算',
    balanceRole: '收益会累计到这里',
    holdRule: '出租收益先进入待结算，窗口结束后转为可结算；结算申请提交平台审批后出款。',
    holding: '待结算',
    unlockIn: '后可结算',
    settle: '结算',
    settleInFlightMsg: '结算申请审核中',
    settleEmpty: '暂无可结算金额',
    settleCta: (v: string) => `结算 ${v}`,
    detail: '收益明细',
    history: '结算记录',
    colNo: '单号',
    colAmount: '金额',
    colStatus: '状态',
    time: '时间',
    settleLabels: { pending: '待审', approved: '已放行 · 冻结', processing: '出款中', sent: '已出款', paid: '已到账', failed: '失败退回', rejected: '已驳回' } as Record<SettleStatus, string>,
    emptyHistory: '还没有结算记录；点击「结算」提交申请后此处出现。',
    gross: '订单金额',
    fee: '平台费用',
    net: '净入账',
    status: '状态',
    ready: '可结算',
    sum: '近 30 天汇总',
    emptyDetail: '还没有收益记录；出租机器后，净收入会先进待结算。',
    total: (n: number) => `共 ${n} 条`,
    prev: '上一页',
    next: '下一页',
    pageOf: (i: number, n: number) => `第 ${i} / ${n} 页`,
    pagination: '分页',
    toastHeld: '结算窗口结束，已转入可结算',
    toastSettle: (v: string) => `结算申请已提交 ${v}，待平台审批`,
    toastAccrue: (fee: string) => `演示收益 $${(20 - Number(fee.slice(1))).toFixed(2)} 已入待结算（平台费用 ${fee}）`,
    simulate: (fee: string) => `模拟收益 $20（平台费用 ${fee}）`,
    demoLabel: '演示',
    demoNote: '演示控制只用于走查状态；真实结算由通道完成。',
  },
  en: {
    title: 'Earnings',
    balance: 'Settleable',
    balanceRole: 'Earnings accumulate here',
    holdRule: 'Rental revenue enters pending first, then becomes settleable once the window ends; requests go through platform approval before payout.',
    holding: 'Pending',
    unlockIn: 'until settleable',
    settle: 'Settle',
    settleInFlightMsg: 'Request under review',
    settleEmpty: 'Nothing settleable yet',
    settleCta: (v: string) => `Settle ${v}`,
    detail: 'Earnings detail',
    history: 'Settlement history',
    colNo: 'No.',
    colAmount: 'Amount',
    colStatus: 'Status',
    time: 'Time',
    settleLabels: { pending: 'Pending', approved: 'Approved · held', processing: 'Processing', sent: 'Sent', paid: 'Paid', failed: 'Failed · returned', rejected: 'Rejected' } as Record<SettleStatus, string>,
    emptyHistory: 'No settlement requests yet; press Settle to submit one.',
    gross: 'Order amount',
    fee: 'Platform fee',
    net: 'Net credited',
    status: 'Status',
    ready: 'Settleable',
    sum: '30-day summary',
    emptyDetail: 'No earnings yet; once your machines are rented, net revenue enters pending first.',
    total: (n: number) => `${n} entries`,
    prev: 'Previous',
    next: 'Next',
    pageOf: (i: number, n: number) => `Page ${i} of ${n}`,
    pagination: 'Pagination',
    toastHeld: 'Settlement window ended; moved to settleable',
    toastSettle: (v: string) => `Settlement request ${v} submitted for approval`,
    toastAccrue: (fee: string) => `Demo earnings $${(20 - Number(fee.slice(1))).toFixed(2)} added to pending (platform fee ${fee})`,
    simulate: (fee: string) => `Simulate $20 earnings (${fee} platform fee)`,
    demoLabel: 'Demo',
    demoNote: 'Demo controls only walk the status; the channel performs the real settlement.',
  },
}

export default function EarningsPage({ lang, account, onSignIn }: {
  lang: Language
  account: Account | null
  onSignIn: (email: string) => void
}) {
  if (!account) return <WalletLocked lang={lang} onSignIn={onSignIn} title={copy[lang].title} />
  return <EarningsAccount key={account.email} lang={lang} email={account.email} />
}

function EarningsAccount({ lang, email }: { lang: Language; email: string }) {
  const t = copy[lang]
  const { wallet, setWallet } = useWallet(email)
  const [toast, setToast] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [earnPage, setEarnPage] = useState(1)

  useEffect(() => { const id = setInterval(() => setTick(v => v + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id) }, [toast])
  const flash = (msg: string) => setToast(msg)

  // —— 结算窗口到期：held → 可结算 ——
  const expireRef = useRef(wallet)
  expireRef.current = wallet
  useEffect(() => {
    const id = setInterval(() => {
      const result = applyHoldUnlock(expireRef.current)
      if (result) {
        setWallet(result.state)
        flash(t.toastHeld)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [t])

  /* tick 参与依赖：倒计时逐秒刷新 */
  const nextUnlock = useMemo(() => {
    const queue = [...wallet.holdQueue].sort((a, b) => a.expireT - b.expireT)
    return queue.length ? Math.max(0, Math.round((queue[0].expireT - Date.now()) / 1000)) : null
  }, [wallet.holdQueue, tick])

  const summary = earnings30d(wallet)
  const earningRows: LedgerRow[] = wallet.earningLedger.filter(row => row.kind === 'earning')
  const earnPages = Math.max(1, Math.ceil(earningRows.length / EARN_PAGE))
  const safeEarnPage = Math.min(earnPage, earnPages)
  const visibleEarn = earningRows.slice((safeEarnPage - 1) * EARN_PAGE, safeEarnPage * EARN_PAGE)

  /* 结算入口：一键申请全部可结算额；同账号同时仅一笔在途 */
  const canSettle = settleable(wallet) > 0.005 && !settleInFlight(wallet)
  const submitSettle = () => {
    const amount = settleable(wallet)
    const next = applySettleSubmit(wallet, amount)
    if (next) {
      setWallet(next)
      flash(t.toastSettle(money(amount)))
    }
  }

  const accrueDemo = () => {
    const fee = +(20 * readRate()).toFixed(2)
    setWallet((prev: WalletState) => applyAccrue(prev, 20, fee))
    flash(t.toastAccrue(money(fee)))
  }

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
              <span className={s.poolRole}>{t.balanceRole} · {t.holding} {money(wallet.held)}
                {nextUnlock !== null && <> · <b>{nextUnlock}s</b> {t.unlockIn}</>}</span>
            </div>
          </header>
          <div className={s.poolFoot}>
            <strong className={s.poolAmount}>{money(settleable(wallet))}</strong>
            {settleInFlight(wallet)
              ? <button className={u.btnPrimary} disabled title={t.settleInFlightMsg}>{t.settleInFlightMsg}</button>
              : <button className={u.btnPrimary} disabled={!canSettle} title={canSettle ? t.settleCta(money(settleable(wallet))) : t.settleEmpty} onClick={submitSettle}>{t.settle}</button>}
          </div>
          <p className={s.poolNote}>{t.holdRule}</p>
        </article>
      </section>

      <section className={s.section} aria-labelledby="earnings-history-title">
        <div className={s.sectionHead}>
          <h2 id="earnings-history-title">{t.history}</h2>
        </div>
        {wallet.settleReqs.length === 0 ? <p className={s.empty}>{t.emptyHistory}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>{t.time}</th><th>{t.colNo}</th><th className={s.right}>{t.colAmount}</th><th>{t.colStatus}</th></tr></thead>
              <tbody>
                {wallet.settleReqs.map((req: SettleRequest) => <tr key={req.id}>
                  <td className={u.mono}>{stampFull(req.at)}</td>
                  <td className={u.mono}>{settleNo(req)}</td>
                  <td className={`${s.right} ${u.mono}`}>{money(req.amount)}</td>
                  <td><Badge tone={req.status === 'paid' ? 'ok' : req.status === 'failed' ? 'bad' : req.status === 'rejected' ? 'muted' : req.status === 'pending' ? 'warn' : 'info'}>{t.settleLabels[req.status]}</Badge></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={s.section} aria-labelledby="earnings-detail-title">
        <div className={s.sectionHead}>
          <h2 id="earnings-detail-title">{t.detail}</h2>
        </div>
        {earningRows.length === 0 ? <p className={s.empty}>{t.emptyDetail}</p> : (<>
          <div className={s.summary}>
            <span className={s.summaryLabel}>{t.sum}</span>
            <div className={s.summaryStats}>
              <span><small>{t.gross}</small><b className={u.mono}>{money(summary.gross)}</b></span>
              <span><small>{t.fee}</small><b className={u.mono}>{money(summary.fee)}</b></span>
              <span><small>{t.net}</small><b className={u.mono}>{money(summary.net)}</b></span>
            </div>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>{t.time}</th><th className={s.right}>{t.gross}</th><th className={s.right}>{t.fee}</th><th className={s.right}>{t.net}</th><th>{t.status}</th></tr></thead>
              <tbody>
                {visibleEarn.map(row => <tr key={row.id}>
                  <td className={u.mono}>{stampFull(row.at)}</td>
                  <td className={`${s.right} ${u.mono}`}>{row.gross === undefined ? '—' : money(row.gross)}</td>
                  <td className={`${s.right} ${u.mono}`}>{row.fee === undefined ? '—' : money(row.fee)}</td>
                  <td className={`${s.right} ${u.mono}`}>{money(row.amount)}</td>
                  <td><Badge tone={row.holdUntil && row.holdUntil > Date.now() ? 'warn' : 'ok'}>
                    {row.holdUntil && row.holdUntil > Date.now() ? t.holding : t.ready}
                  </Badge></td>
                </tr>)}
              </tbody>
            </table>
            <PageNav page={safeEarnPage} pages={earnPages} count={earningRows.length} t={t}
              onPage={next => setEarnPage(Math.min(Math.max(next, 1), earnPages))} />
          </div>
        </>)}
      </section>

      {/* 演示层：统一虚线框，不混入数据区；置于明细下方，对版面影响最小 */}
      <div className={s.demoRow}>
        <span className={s.demoLabel}>{t.demoLabel}</span>
        <button className={s.demoBtn} onClick={accrueDemo}>{t.simulate(money(+(20 * readRate()).toFixed(2)))}</button>
        <span className={s.demoNote}>{t.demoNote}</span>
      </div>
    </div>

    {toast && <div className={u.toast} role="status">{toast}</div>}
  </div>
}
