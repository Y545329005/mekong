/* ============================================================================
   THESIS  租户资金页只回答四件事：两个池各有多少钱、怎么充进去、最近开的
           订单在哪取消、每笔钱怎么进出。主语是两个池，不设「账户总额」，
           不设冻结区，不建订单中心。
   OWN-WORLD  白底，复用算力市场白区色板：#fff 底、#17212c 标题、#34475a 正文、
           #627386 次要、#315f90 强调、#dce2e8/#e1e6ec 描边；深色 header 由
           App 层保留（市场页同样叠法）。等宽数字，1px 冷灰分隔线。
   STORY  订单取消：退款只回平台余额（原扣款池），不触第三方、不产生通道退款，
           流水说明「订单取消 · 退回余额」——与充值环节的支付异常退款（原链退回）
           是两条链路，话术严格分开。
   FORM  余额并列 → 充值 → 最近订单（3 条，可取消）→ 流水（时间/说明/金额/该池余额）。
   ========================================================================== */

import { useEffect, useState } from 'react'
import type { Language } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { CHANNEL, RAIL_LABEL, applyCancelOrder, applyTopup, money, stamp, useWallet } from './wallet/store'
import type { LedgerRow, Rail, WalletState } from './wallet/store'
import { TopupFlow } from './wallet/Topup'
import { Badge } from './wallet/ui'
import u from './wallet/ui.module.css'
import s from './WalletPage.module.css'

const copy = {
  zh: {
    title: '资金与结算',
    lead: '法币走 Airwallex 托管收单，链上走 Infini 收款。两个池各自记账，充值、消费与退款都落在各自的池里，不合并计算。',
    boundTo: '资金归属于账户',
    pools: '余额',
    railFiat: '法币池',
    railCrypto: '链上池',
    roleFiat: '托管收单 · 卡 / Apple Pay / Google Pay',
    roleCrypto: '链上收款 · USDT-TRC20',
    available: '可用余额',
    topup: '充值',
    orders: '最近订单',
    ordersLead: '仅展示最近 3 条；取消订单的退款回到原扣款池。',
    machine: '机器',
    amount: '金额',
    status: '状态',
    cancelAction: '取消',
    orderOpen: '开通中',
    orderProvisioned: '已开通',
    orderCancelled: '已取消',
    noOrders: '还没有订单',
    ledger: '资金流水',
    ledgerLead: '金额后的余额为该笔流水所在池的余额。',
    time: '时间',
    desc: '说明',
    poolBalance: '该池余额',
    noLedger: '暂无流水',
    descTopup: '充值入账',
    descConsume: '订单扣款',
    descRefund: '订单取消 · 退回余额',
    toastTopup: (v: string, r: string) => `${r}入账 $${v}`,
    toastRefund: '异常支付已按原链退回，未计入余额',
    toastCancel: (v: string, r: string) => `订单已取消 · $${v} 已退回${r}`,
  },
  en: {
    title: 'Funds & settlement',
    lead: 'Fiat runs through Airwallex hosted collection; on-chain runs through Infini. Each pool keeps its own ledger — top-ups, spending and refunds land in the pool they belong to and are never combined.',
    boundTo: 'Funds belong to',
    pools: 'Balances',
    railFiat: 'Fiat pool',
    railCrypto: 'On-chain pool',
    roleFiat: 'Hosted collection · Card / Apple Pay / Google Pay',
    roleCrypto: 'On-chain collection · USDT-TRC20',
    available: 'Available',
    topup: 'Top up',
    orders: 'Recent orders',
    ordersLead: 'The latest 3 only; cancelling an order refunds the pool it was paid from.',
    machine: 'Machine',
    amount: 'Amount',
    status: 'Status',
    cancelAction: 'Cancel',
    orderOpen: 'Provisioning',
    orderProvisioned: 'Provisioned',
    orderCancelled: 'Cancelled',
    noOrders: 'No orders yet',
    ledger: 'Ledger',
    ledgerLead: 'The balance after each entry belongs to the pool that entry touched.',
    time: 'Time',
    desc: 'Description',
    poolBalance: 'Pool balance',
    noLedger: 'No entries yet',
    descTopup: 'Top-up credited',
    descConsume: 'Order charge',
    descRefund: 'Order cancelled · refunded to balance',
    toastTopup: (v: string, r: string) => `${r} credited $${v}`,
    toastRefund: 'Abnormal payment refunded on chain, not credited',
    toastCancel: (v: string, r: string) => `Order cancelled · $${v} returned to the ${r}`,
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
  const railText = RAIL_LABEL[lang]
  const { wallet, setWallet } = useWallet(email)
  const [toast, setToast] = useState<string | null>(null)
  const [topupRail, setTopupRail] = useState<Rail | null>(null)

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id) }, [toast])
  const flash = (msg: string) => setToast(msg)

  const credit = (rail: Rail, amount: number) => {
    setWallet((prev: WalletState) => applyTopup(prev, rail, amount))
    flash(t.toastTopup(amount.toFixed(2), railText[rail]))
  }
  const cancelOrder = (id: string) => {
    const order = wallet.orders.find(o => o.id === id)
    if (!order || order.status !== 'open') return
    setWallet(prev => applyCancelOrder(prev, id) ?? prev)
    flash(t.toastCancel(order.amount.toFixed(2), railText[order.pool]))
  }

  const desc = (row: LedgerRow) =>
    row.kind === 'topup' ? t.descTopup : row.kind === 'consume' ? t.descConsume : row.kind === 'refund' ? t.descRefund : ''
  // 租户流水只含三类（收益/出金流水属宿主页口径）
  const ledgerRows = wallet.ledger.filter(row => row.kind === 'topup' || row.kind === 'consume' || row.kind === 'refund')

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
              <span className={s.poolRole}>{rail === 'fiat' ? t.roleFiat : t.roleCrypto}</span>
            </div>
            <span className={s.poolTag}>{railText[rail]}</span>
          </header>
          <div className={s.poolFigure}>
            <span>{t.available}</span>
            <strong>{money(wallet.balance[rail])}</strong>
          </div>
          <button className={u.btnPrimary} onClick={() => setTopupRail(rail)}>{t.topup}</button>
        </article>)}
      </section>

      <section className={s.section} aria-labelledby="wallet-orders-title">
        <div className={s.sectionHead}>
          <h2 id="wallet-orders-title">{t.orders}</h2>
          <p>{t.ordersLead}</p>
        </div>
        {wallet.orders.length === 0 ? <p className={s.empty}>{t.noOrders}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>{t.machine}</th><th className={s.right}>{t.amount}</th><th>{t.status}</th><th aria-label={t.cancelAction} /></tr></thead>
              <tbody>
                {wallet.orders.slice(0, 3).map(order => <tr key={order.id}>
                  <td className={s.machine}>{order.machine}</td>
                  <td className={`${s.right} ${u.mono}`}>{money(order.amount)}</td>
                  <td><Badge tone={order.status === 'provisioned' ? 'ok' : order.status === 'open' ? 'info' : 'muted'}>{order.status === 'provisioned' ? t.orderProvisioned : order.status === 'open' ? t.orderOpen : t.orderCancelled}</Badge></td>
                  <td className={s.right}>{order.status === 'open'
                    ? <button className={u.miniBtn} onClick={() => cancelOrder(order.id)}>{t.cancelAction}</button>
                    : null}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={s.section} aria-labelledby="wallet-ledger-title">
        <div className={s.sectionHead}>
          <h2 id="wallet-ledger-title">{t.ledger}</h2>
          <p>{t.ledgerLead}</p>
        </div>
        {ledgerRows.length === 0 ? <p className={s.empty}>{t.noLedger}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>{t.time}</th><th>{t.desc}</th><th className={s.right}>{t.amount}</th><th className={s.right}>{t.poolBalance}</th></tr></thead>
              <tbody>{ledgerRows.map(row => <tr key={row.id}>
                <td className={u.mono}>{stamp(row.at)}</td>
                <td>
                  <span className={s.descWrap}>
                    <span className={s.poolChip} data-rail={row.rail}>{railText[row.rail]}</span>
                    {desc(row)}{row.label && <span className={s.descLabel}>{row.label}</span>}
                  </span>
                </td>
                <td className={`${s.right} ${u.mono}`}>{row.kind === 'consume' ? '-' : '+'}{money(row.amount)}</td>
                <td className={`${s.right} ${u.mono}`}>{row.balAfter === undefined ? '—' : money(row.balAfter)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>

    {topupRail !== null && <TopupFlow lang={lang} rail={topupRail}
      onClose={() => setTopupRail(null)}
      onCredit={(rail, amount) => { credit(rail, amount); setTopupRail(null) }}
      onRefund={() => { flash(t.toastRefund); setTopupRail(null) }} />}

    {toast && <div className={u.toast} role="status">{toast}</div>}
  </div>
}
