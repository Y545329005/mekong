/* ============================================================================
   THESIS  宿主收益页回答：两个池各能提多少、钱在持有期里还要等多久、近 30 天
           赚了多少、抽成几何、出金走到哪一步、钱提到哪个账户。主语是收益池，
           不展示租户余额，不做充值。
   OWN-WORLD  白底，与算力市场白区同一套值（#fff/#17212c/#34475a/#627386/
           #315f90/#dce2e8、#e1e6ec）；深色 header 由 App 层保留。等宽数字。
   STORY  收益先进持有期（结算 + 争议窗口），到期自动转可提现；出金按通道分流：
           法币 scheduled → processing → sent → paid（四步，可取消/失败退回），
           链上 pending → processing → completed（三步，失败原链退回）。
           扣款点统一在 processing；失败已扣金额退回原池。
   FORM  两池可提现 → 持有期 → 近 30 天收入 → 提现 → 收益明细（含平台抽成汇总）
         → 出金记录 → 收款账户。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { CHANNEL, RAIL_LABEL, applyAccountSave, applyAccrue, applyHoldUnlock, applyPayoutAdvance, applyPayoutSubmit, earnings30d, money, stamp, useWallet, withdrawable } from './wallet/store'
import type { PayoutRequest, PayoutStatus, Rail, WalletState } from './wallet/store'
import { WithdrawModal, AccountsModal } from './wallet/Withdraw'
import { Badge } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './EarningsPage.module.css'

const copy = {
  zh: {
    title: '收益',
    lead: '出租收益按资产池分流：法币收益走 Airwallex 同名出金，链上收益走 Infini 链上提现。收益先入持有期，度过结算与争议窗口后自动转可提现。',
    boundTo: '收益归属于账户',
    pools: '可提现',
    railFiat: '法币池',
    railCrypto: '链上池',
    withdraw: '提现',
    holding: '持有期',
    holdingNote: '结算完成并度过争议窗口后解锁，到期自动转入可提现。',
    unlockIn: '最近一批解锁',
    simulate: '模拟收益 $20（抽成 $2）',
    net30: '近 30 天收入',
    netNote: (fee: string) => `已扣平台抽成 $${fee}`,
    detail: '收益明细',
    detailLead: '净入账先进持有期；汇总为近 30 天口径。',
    time: '时间',
    gross: '毛收入',
    fee: '平台抽成',
    net: '净入账',
    sum: '近 30 天汇总',
    payouts: '出金记录',
    payoutsFiat: '法币 · Airwallex（四步）',
    payoutsCrypto: '链上 · Infini（三步）',
    noPayouts: '该通道还没有出金记录',
    demoNote: '真实环境由运营在出金台推进这些状态；失败或取消的出金退回原池。',
    st_scheduled: '已排程 · 冻结中',
    st_processing: '出款中',
    st_sent: '已汇出',
    st_paid: '已到账',
    st_pending: '待处理',
    st_completed: '已完成（链上确认）',
    st_failed: '失败 · 已退回',
    st_cancelled: '已取消',
    send: '发起出款',
    markSent: '标记汇出',
    markPaid: '标记到账',
    markComplete: '链上确认',
    markFail: '出款失败',
    cancelPayout: '取消出金',
    accounts: '收款账户',
    accountFiat: '法币 · 同名银行账户',
    accountCrypto: '链上 · 自有钱包',
    noAccount: '尚未绑定收款账户',
    manage: '管理',
    toastHeld: (v: string) => `持有期解锁 $${v}`,
    toastPayout: '提现申请已提交',
    toastAccrue: '演示收益 $18 已入持有期',
  },
  en: {
    title: 'Earnings',
    lead: 'Host revenue follows the asset pools: fiat earnings pay out through Airwallex to a same-name bank account, on-chain earnings withdraw through Infini. Revenue first sits in holding, then unlocks automatically once settlement and the dispute window pass.',
    boundTo: 'Earnings belong to',
    pools: 'Withdrawable',
    railFiat: 'Fiat pool',
    railCrypto: 'On-chain pool',
    withdraw: 'Withdraw',
    holding: 'In holding',
    holdingNote: 'Unlocks after settlement completes and the dispute window passes, then moves to withdrawable.',
    unlockIn: 'Next unlock',
    simulate: 'Simulate $20 earnings ($2 fee)',
    net30: 'Net revenue · 30 days',
    netNote: (fee: string) => `Platform fee $${fee} deducted`,
    detail: 'Earnings detail',
    detailLead: 'Net amounts enter holding first; the summary covers the last 30 days.',
    time: 'Time',
    gross: 'Gross',
    fee: 'Platform fee',
    net: 'Net credited',
    sum: '30-day summary',
    payouts: 'Payouts',
    payoutsFiat: 'Fiat · Airwallex (4 steps)',
    payoutsCrypto: 'On-chain · Infini (3 steps)',
    noPayouts: 'No payouts on this channel yet',
    demoNote: 'In production an operator advances these from the payout console; failed or cancelled payouts return to the pool.',
    st_scheduled: 'Scheduled · frozen',
    st_processing: 'Processing',
    st_sent: 'Sent',
    st_paid: 'Paid',
    st_pending: 'Pending',
    st_completed: 'Completed on chain',
    st_failed: 'Failed · refunded',
    st_cancelled: 'Cancelled',
    send: 'Initiate payout',
    markSent: 'Mark sent',
    markPaid: 'Mark paid',
    markComplete: 'Confirm on chain',
    markFail: 'Mark failed',
    cancelPayout: 'Cancel payout',
    accounts: 'Payout accounts',
    accountFiat: 'Fiat · same-name bank account',
    accountCrypto: 'On-chain · own wallet',
    noAccount: 'No payout account yet',
    manage: 'Manage',
    toastHeld: (v: string) => `Holding unlocked $${v}`,
    toastPayout: 'Withdrawal submitted',
    toastAccrue: 'Demo earnings $18 added to holding',
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
  const railText = RAIL_LABEL[lang]
  const { wallet, setWallet } = useWallet(email)
  const [toast, setToast] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'withdraw' | 'accounts'>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => { const id = setInterval(() => setTick(v => v + 1), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id) }, [toast])
  const flash = (msg: string) => setToast(msg)

  // —— 持有期到期：held → 可提现 ——
  const expireRef = useRef(wallet)
  expireRef.current = wallet
  useEffect(() => {
    const id = setInterval(() => {
      const result = applyHoldUnlock(expireRef.current)
      if (result) {
        setWallet(result.state)
        flash(t.toastHeld(result.unlocked.toFixed(2)))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [t])

  const nextUnlock = useMemo(() => {
    const queue = [...wallet.holdQueue].sort((a, b) => a.expireT - b.expireT)
    if (!queue.length) return null
    return Math.max(0, Math.round((queue[0].expireT - Date.now()) / 1000))
    // tick：让倒计时逐秒刷新
  }, [wallet.holdQueue, tick])

  const heldTotal = +(wallet.held.fiat + wallet.held.crypto).toFixed(2)
  const summary = earnings30d(wallet)
  const inFlight = wallet.payouts.some(r => r.status === 'pending' || r.status === 'scheduled' || r.status === 'processing' || r.status === 'sent')

  const accrueDemo = () => {
    setWallet((prev: WalletState) => applyAccrue(prev, 'fiat', 20, 2))
    flash(t.toastAccrue)
  }
  const submitPayout = (rail: Rail, accountLabel: string, amount: number) => {
    setWallet((prev: WalletState) => applyPayoutSubmit(prev, rail, accountLabel, amount))
    flash(t.toastPayout)
  }

  return <div className={s.page}>
    <div className={s.shell}>
      <header className={s.head}>
        <h1>{t.title}</h1>
        <p className={s.lead}>{t.lead}</p>
        <p className={s.accountLine}>{t.boundTo} <b>{email}</b></p>
      </header>

      <section className={s.pools} aria-label={t.pools}>
        {(['fiat', 'crypto'] as Rail[]).map(rail => <article key={rail} className={s.pool} data-rail={rail}>
          <header className={s.poolHead}>
            <span className={s.poolMark} aria-hidden="true" />
            <div className={s.poolIdentity}>
              <span className={s.poolVendor}>{CHANNEL[rail]}</span>
              <span className={s.poolTag}>{railText[rail]}</span>
            </div>
          </header>
          <div className={s.poolFigure}>
            <span>{t.pools}</span>
            <strong>{money(withdrawable(wallet, rail))}</strong>
          </div>
          <button className={u.btnPrimary} disabled={inFlight} title={inFlight ? '已有出金申请在途' : undefined}
            onClick={() => setModal('withdraw')}>{t.withdraw}</button>
        </article>)}
      </section>

      <section className={s.strip} aria-label={t.holding}>
        <div className={s.stripItem}>
          <span>{t.holding}</span>
          <strong>{money(heldTotal)}</strong>
          <em>{railText.fiat} {money(wallet.held.fiat)} · {railText.crypto} {money(wallet.held.crypto)}</em>
          {nextUnlock !== null && <em>{t.unlockIn} <b>{nextUnlock}s</b></em>}
          <p>{t.holdingNote}</p>
        </div>
        <div className={s.stripItem}>
          <span>{t.net30}</span>
          <strong>{money(summary.net)}</strong>
          <em>{t.netNote(summary.fee.toFixed(2))}</em>
          <button className={s.demoBtn} onClick={accrueDemo}>{t.simulate}</button>
        </div>
      </section>

      <section className={s.section} aria-labelledby="earnings-detail-title">
        <div className={s.sectionHead}>
          <h2 id="earnings-detail-title">{t.detail}</h2>
          <p>{t.detailLead}</p>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>{t.time}</th><th>{lang === 'zh' ? '通道' : 'Channel'}</th><th className={s.right}>{t.gross}</th><th className={s.right}>{t.fee}</th><th className={s.right}>{t.net}</th></tr></thead>
            <tbody>
              {wallet.ledger.filter(row => row.kind === 'earning').slice(0, 8).map(row => <tr key={row.id}>
                <td className={u.mono}>{stamp(row.at)}</td>
                <td><span className={s.poolChip} data-rail={row.rail}>{railText[row.rail]}</span></td>
                <td className={`${s.right} ${u.mono}`}>{row.gross === undefined ? '—' : money(row.gross)}</td>
                <td className={`${s.right} ${u.mono}`}>{row.fee === undefined ? '—' : money(row.fee)}</td>
                <td className={`${s.right} ${u.mono}`}>{money(row.amount)}</td>
              </tr>)}
              <tr className={s.sumRow}>
                <td colSpan={2}>{t.sum}</td>
                <td className={`${s.right} ${u.mono}`}>{money(summary.gross)}</td>
                <td className={`${s.right} ${u.mono}`}>{money(summary.fee)}</td>
                <td className={`${s.right} ${u.mono}`}>{money(summary.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.section} aria-labelledby="earnings-payouts-title">
        <div className={s.sectionHead}><h2 id="earnings-payouts-title">{t.payouts}</h2></div>
        <div className={s.payoutGrid}>
          {(['fiat', 'crypto'] as Rail[]).map(rail => <div key={rail} className={s.payoutGroup} data-rail={rail}>
            <h3>{rail === 'fiat' ? t.payoutsFiat : t.payoutsCrypto}</h3>
            {wallet.payouts.filter(p => p.rail === rail).length === 0
              ? <p className={s.payoutEmpty}>{t.noPayouts}</p>
              : wallet.payouts.filter(p => p.rail === rail).map(req => <PayoutRow key={req.id} req={req} t={t}
                onAdvance={to => setWallet((prev: WalletState) => applyPayoutAdvance(prev, req.id, to))} />)}
          </div>)}
          <p className={s.payoutNote}>{t.demoNote}</p>
        </div>
      </section>

      <section className={s.section} aria-labelledby="earnings-accounts-title">
        <div className={s.sectionHead}>
          <h2 id="earnings-accounts-title">{t.accounts}</h2>
          <button className={s.textBtn} onClick={() => setModal('accounts')}>{t.manage}</button>
        </div>
        <div className={s.accountGrid}>
          {(['fiat', 'crypto'] as Rail[]).map(rail => {
            const list = wallet.accounts.filter(a => a.rail === rail)
            const primary = list.find(a => a.isDefault) ?? list[0]
            return <div key={rail} className={s.accountCard}>
              <span className={s.accountLabel}>{rail === 'fiat' ? t.accountFiat : t.accountCrypto}</span>
              <span className={`${u.mono} ${s.accountMono}`}>{primary
                ? primary.rail === 'fiat' ? `${primary.label} · ${primary.bank} · •••• ${primary.tail}` : `${primary.chain} · •••• ${primary.tail}`
                : t.noAccount}</span>
            </div>
          })}
        </div>
      </section>
    </div>

    {modal === 'withdraw' && <WithdrawModal lang={lang} wallet={wallet}
      onClose={() => setModal(null)} onSubmit={submitPayout} onManage={() => setModal('accounts')} />}
    {modal === 'accounts' && <AccountsModal lang={lang} wallet={wallet}
      onClose={() => setModal(null)}
      onSave={account => { setWallet((prev: WalletState) => applyAccountSave(prev, account)); setModal(null) }} />}

    {toast && <div className={u.toast} role="status">{toast}</div>}
  </div>
}

/* ---------------------------------------------------------------- 出金单行 */

function PayoutRow({ req, t, onAdvance }: {
  req: PayoutRequest
  t: typeof copy.zh
  onAdvance: (to: PayoutStatus) => void
}) {
  const buttons: Array<[string, PayoutStatus]> = []
  if (req.rail === 'fiat') {
    if (req.status === 'scheduled') buttons.push([t.send, 'processing'])
    if (req.status === 'processing') buttons.push([t.markSent, 'sent'])
    if (req.status === 'sent') buttons.push([t.markPaid, 'paid'])
    if (req.status === 'scheduled') buttons.push([t.cancelPayout, 'cancelled'])
  } else {
    if (req.status === 'pending') buttons.push([t.send, 'processing'])
    if (req.status === 'processing') buttons.push([t.markComplete, 'completed'])
  }
  const terminal = req.status === 'paid' || req.status === 'completed' || req.status === 'failed' || req.status === 'cancelled'
  if (!terminal) buttons.push([t.markFail, 'failed'])

  const tone = req.status === 'paid' || req.status === 'completed' ? 'ok'
    : req.status === 'failed' ? 'bad'
    : req.status === 'cancelled' ? 'muted' : 'info'

  return <div className={s.payoutRow}>
    <div className={s.payoutMain}>
      <strong className={u.mono}>{money(req.amount)}</strong>
      <span className={s.payoutAccount}>{req.account}</span>
    </div>
    <div className={s.payoutMeta}>
      <Badge tone={tone}>{t[`st_${req.status}` as keyof typeof t] as string}</Badge>
      <div className={s.advanceRow}>{buttons.map(([label, next]) =>
        <button key={next} className={u.miniBtn} onClick={() => onAdvance(next)}>{label}</button>)}</div>
    </div>
  </div>
}
