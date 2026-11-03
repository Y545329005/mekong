/* ============================================================================
   充值流程（法币 Airwallex 托管收单 / 链上 Infini 收银台，演示态）
   · 供租户资金页与租用确认页共用：余额不足时从这里补足，回到原流程
   · 通道可在弹窗内切换；法币最低 $16、链上最低 $10
   · 异常支付（少付/多付/超时）不入账，按原链退回——与订单取消（回平台余额）
     是两条链路，文案不共用
   ========================================================================== */

import { useState } from 'react'
import type { Language } from '../content'
import { CHANNEL, MIN_TOPUP, money } from './store'
import type { Rail } from './store'
import { Overlay } from './ui'
import u from './ui.module.css'

const copy = {
  zh: {
    title: '充值',
    leadFiat: '点「支付」进入 Airwallex 托管收单页；付款完成后回到本站，法币池以通道结算结果入账。',
    leadCrypto: '点「支付」打开 Infini 收银台：展示 USDT-TRC20 地址与订单有效期，链上确认后入账。',
    amountLabel: '金额（美元）',
    method: '支付方式',
    card: '银行卡',
    applePay: 'Apple Pay',
    googlePay: 'Google Pay',
    minFiat: '法币单笔 ≥ $16 · 提现起提 $20',
    minCrypto: '链上单笔 ≥ $10 · 提现起提 $20',
    cryptoMethod: 'USDT · TRC20',
    hostedFiatTitle: 'Airwallex 托管收单',
    hostedFiatLead: '卡要素、Apple Pay 与 Google Pay 都在该页完成，本站不接触卡号。',
    hostedCryptoNote: '真实产品在此展示收款地址、二维码与订单有效期；链上确认后自动入账。',
    hostedDemoNote: '演示：以下按钮模拟你在收单页 / 收银台的操作结果，仅影响本站演示数据。',
    cryptoRefund: '模拟异常支付 · 原链退回',
    cryptoDone: '模拟链上到账',
    success: '模拟付款成功',
    fail: '模拟付款失败',
    failed: '付款失败，未入账。可重试或取消。',
    refundNote: '异常支付（少付 / 多付 / 超时）不会入账：需发起退款，本金按原链退回；认领期内未提交收款地址的，款项结算给平台。',
    later: '稍后再说',
    pay: '支付',
    cancel: '取消',
  },
  en: {
    title: 'Top up',
    leadFiat: 'Press Pay to continue on the Airwallex hosted checkout; the fiat pool is credited from the channel settlement, not from the return page.',
    leadCrypto: 'Press Pay to open the Infini checkout with a USDT-TRC20 address and order expiry; credited after on-chain confirmation.',
    amountLabel: 'Amount (USD)',
    method: 'Payment method',
    card: 'Card',
    applePay: 'Apple Pay',
    googlePay: 'Google Pay',
    minFiat: 'Minimum $16 · withdrawals from $20',
    minCrypto: 'Minimum $10 · withdrawals from $20',
    cryptoMethod: 'USDT · TRC20',
    hostedFiatTitle: 'Airwallex hosted checkout',
    hostedFiatLead: 'Card details, Apple Pay and Google Pay are all handled on that page; card numbers never reach this site.',
    hostedCryptoNote: 'The real page shows the deposit address, QR code and order expiry; credited automatically once confirmed on chain.',
    hostedDemoNote: 'Demo: these buttons simulate your result on the hosted page or checkout and only touch this site’s demo data.',
    cryptoRefund: 'Simulate abnormal payment · refund on chain',
    cryptoDone: 'Simulate on-chain credit',
    success: 'Simulate successful payment',
    fail: 'Simulate failed payment',
    failed: 'Payment failed and was not credited. Retry or cancel.',
    refundNote: 'Abnormal payments (under/over-paid, expired) are never credited: start a refund to return the principal on the original chain; funds without a payout address inside the claim window settle to the platform.',
    later: 'Later',
    pay: 'Pay',
    cancel: 'Cancel',
  },
}

const RAIL_TEXT = { zh: { fiat: '法币池', crypto: '链上池' }, en: { fiat: 'Fiat pool', crypto: 'On-chain pool' } }

export function TopupFlow({ lang, rail: initialRail, onClose, onCredit, onRefund }: {
  lang: Language
  rail: Rail
  onClose: () => void
  onCredit: (rail: Rail, amount: number) => void
  onRefund: () => void
}) {
  const t = copy[lang]
  const railText = RAIL_TEXT[lang]
  const [draft, setDraft] = useState<{ rail: Rail; amount: number; method: string }>({
    rail: initialRail, amount: Math.max(25, MIN_TOPUP[initialRail]), method: initialRail === 'fiat' ? 'card' : 'crypto',
  })
  const [view, setView] = useState<'form' | 'hosted'>('form')
  const [stage, setStage] = useState<'idle' | 'failed'>('idle')

  const min = MIN_TOPUP[draft.rail]
  const presets = [10, 20, 50, 100, 200].filter(value => value >= min)
  const methods: Array<[string, string]> = [['card', t.card], ['applepay', t.applePay], ['googlepay', t.googlePay]]
  const valid = draft.amount >= min
  const crypto = draft.rail === 'crypto'

  if (view === 'hosted') return <Overlay lang={lang} onClose={() => setView('form')} label={crypto ? t.cryptoMethod : t.hostedFiatTitle}>
    <div className={u.head}><h2>{crypto ? `${CHANNEL.crypto} · ${t.cryptoMethod}` : t.hostedFiatTitle}</h2>
      <p>{crypto ? t.hostedCryptoNote : t.hostedFiatLead}</p></div>
    <div className={u.body}>
      <div className={u.amountRow}><span>{t.amountLabel}</span><strong>{money(draft.amount)}</strong></div>
      {crypto
        ? <div className={u.cryptoBox}>
            <div className={u.qr} aria-hidden="true" />
            <div><strong>USDT · TRC20</strong><p>TQ5xDemoWalletAddress0000000000</p><p>{t.refundNote}</p></div>
          </div>
        : <div className={u.skeletonRow} aria-hidden="true"><span /><span /><span /></div>}
      {stage === 'failed' && <p className={u.warn}>{t.failed}</p>}
      <p className={u.note}>{t.hostedDemoNote}</p>
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={() => setView('form')}>{t.cancel}</button>
      {crypto
        ? <>
            <button className={u.btnGhost} onClick={onRefund}>{t.cryptoRefund}</button>
            <button className={u.btnPrimary} onClick={() => onCredit(draft.rail, draft.amount)}>{t.cryptoDone}</button>
          </>
        : stage === 'failed'
          ? <button className={u.btnPrimary} onClick={() => setStage('idle')}>{t.success}</button>
          : <>
              <button className={u.btnGhost} onClick={() => setStage('failed')}>{t.fail}</button>
              <button className={u.btnPrimary} onClick={() => onCredit(draft.rail, draft.amount)}>{t.success}</button>
            </>}
    </div>
  </Overlay>

  return <Overlay lang={lang} onClose={onClose} label={t.title}>
    <div className={u.head}><h2>{t.title} · {CHANNEL[draft.rail]}</h2>
      <p>{draft.rail === 'fiat' ? t.leadFiat : t.leadCrypto}</p></div>
    <div className={u.body}>
      <div className={u.tabs} role="tablist">
        {(['fiat', 'crypto'] as Rail[]).map(key => <button key={key} role="tab" aria-selected={draft.rail === key}
          className={u.tab} data-active={draft.rail === key}
          onClick={() => setDraft({ rail: key, method: key === 'fiat' ? 'card' : 'crypto', amount: Math.max(25, MIN_TOPUP[key]) })}>
          {CHANNEL[key]} <b className={u.tabPool}>{railText[key]}</b></button>)}
      </div>

      <div className={u.presets}>{presets.map(value => <button key={value} className={u.preset} data-active={draft.amount === value}
        onClick={() => setDraft({ ...draft, amount: value })}>{money(value).replace('.00', '')}</button>)}
        <input className={u.input} type="number" min={min} value={draft.amount} aria-label={t.amountLabel}
          onChange={event => setDraft({ ...draft, amount: Math.max(0, Number(event.target.value) || 0) })} /></div>
      <p className={u.note}>{draft.rail === 'fiat' ? t.minFiat : t.minCrypto}</p>

      {draft.rail === 'fiat' ? <>
        <span className={u.fieldLabel}>{t.method}</span>
        <div className={u.methodGrid}>{methods.map(([key, label]) => <button key={key} className={u.method} data-active={draft.method === key}
          onClick={() => setDraft({ ...draft, method: key })}>{label}</button>)}</div>
      </> : <>
        <div className={u.cryptoBox}>
          <strong>{t.cryptoMethod}</strong>
          <p>{t.hostedCryptoNote}</p>
        </div>
        <p className={u.note}>{t.refundNote}</p>
      </>}
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={onClose}>{t.later}</button>
      <button className={u.btnPrimary} disabled={!valid} onClick={() => { setStage('idle'); setView('hosted') }}>{t.pay} {money(draft.amount)}</button>
    </div>
  </Overlay>
}
