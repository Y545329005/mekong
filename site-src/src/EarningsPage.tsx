/* ============================================================================
   THESIS  宿主收益页回答：现在能结算多少、多少还在待结算、近 30 天赚了多少、
           结算走到哪一步。主语是收益，不展示租户余额，不做充值。
   OWN-WORLD  白底，与算力市场白区同一套值（#fff/#17212c/#34475a/#627386/
           #315f90/#dce2e8、#e1e6ec）；深色 header 由 App 层保留。等宽数字。
   STORY  收益先进待结算（结算 + 争议窗口），到期转可结算；结算通道尚未开通，
           因此入口占位、不产生结算记录。企业宿主走线下，不进入本页。
   FORM  收益卡（规则并入卡内）→ 收益明细（30 天汇总块 + 分页）→ 演示层。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { applyAccrue, applyHoldUnlock, earnings30d, money, settleable, stampFull, useWallet } from './wallet/store'
import type { LedgerRow, WalletState } from './wallet/store'
import { Badge, PageNav } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './EarningsPage.module.css'

const EARN_PAGE = 8

const copy = {
  zh: {
    title: '收益',
    balance: '可结算',
    balanceRole: '收益会累计到这里',
    holdRule: '出租收益先进入待结算，窗口结束后转为可结算；结算通道开通中。',
    holding: '待结算',
    unlockIn: '后可结算',
    settle: '结算',
    settlePending: '结算通道开通中',
    simulate: '模拟收益 $20（平台费用 $2）',
    demoLabel: '演示',
    demoNote: '演示控制只用于走查状态；真实结算由通道完成。',
    detail: '收益明细',
    time: '时间',
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
    toastAccrue: '演示收益 $18 已入待结算',
  },
  en: {
    title: 'Earnings',
    balance: 'Settleable',
    balanceRole: 'Earnings accumulate here',
    holdRule: 'Rental revenue enters pending first, then becomes settleable once the window ends; the settlement channel is being enabled.',
    holding: 'Pending',
    unlockIn: 'until settleable',
    settle: 'Settle',
    settlePending: 'Settlement channel is being enabled',
    simulate: 'Simulate $20 earnings ($2 platform fee)',
    demoLabel: 'Demo',
    demoNote: 'Demo controls only walk the status; the channel performs the real settlement.',
    detail: 'Earnings detail',
    time: 'Time',
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
    toastAccrue: 'Demo earnings $18 added to pending',
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

  const accrueDemo = () => {
    setWallet((prev: WalletState) => applyAccrue(prev, 20, 2))
    flash(t.toastAccrue)
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
            <button className={u.btnPrimary} disabled title={t.settlePending}>{t.settle}</button>
          </div>
          <p className={s.poolNote}>{t.holdRule}</p>
        </article>
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
        <button className={s.demoBtn} onClick={accrueDemo}>{t.simulate}</button>
        <span className={s.demoNote}>{t.demoNote}</span>
      </div>
    </div>

    {toast && <div className={u.toast} role="status">{toast}</div>}
  </div>
}
