/* ============================================================================
   充值（演示态：卡走托管收单页 / USDT 走链上收银台）
   · 一个 USD 余额：入金方式只是支付手段，入账金额都是 USD
   · 卡：Airwallex 托管页；USDT：Infini 收银台（按订单 USD 金额报价）
   · 最低额：卡 $16（平台策略值）、USDT 10（严于官方 >0.1）
   · 异常支付原链退回、不入账
   ========================================================================== */

import { useState } from 'react'
import type { Language } from '../content'
import { MIN_TOPUP, money, usdt } from './store'
import type { Channel } from './store'
import { Overlay } from './ui'
import u from './ui.module.css'

const copy = {
  zh: {
    title: '充值',
    lead: '充值进入同一个 USD 余额；银行卡与稳定币只是入金方式不同。',
    method: '入金方式',
    methodCard: '银行卡',
    methodCardHint: '卡 / Apple Pay / Google Pay',
    methodCrypto: 'USDT',
    methodCryptoHint: 'TRC20，按收银台报价折算',
    amount: '充值金额（美元）',
    customAmount: '自定义金额',
    minCard: '单笔 ≥ $16',
    minCrypto: '单笔 ≥ $10',
    cryptoRate: '实际应付 USDT 以收银台报价为准；入账金额为上面填写的美元金额。',
    hostedCardTitle: '收银台',
    hostedCardLead: '卡要素、Apple Pay 与 Google Pay 都在该页完成，本站不接触卡号。',
    hostedCryptoNote: '转账至下方地址，或扫描二维码；链上确认后自动入账。',
    cryptoRefund: '模拟异常支付 · 原链退回',
    cryptoDone: '模拟链上到账',
    success: '模拟付款成功',
    fail: '模拟付款失败',
    failed: '付款失败，未入账。可重试或取消。',
    later: '稍后再说',
    pay: '支付',
    cancel: '取消',
  },
  en: {
    title: 'Top up',
    lead: 'Both methods credit the same USD balance; card and stablecoin are just ways to pay.',
    method: 'Funding method',
    methodCard: 'Bank card',
    methodCardHint: 'Card / Apple Pay / Google Pay',
    methodCrypto: 'USDT',
    methodCryptoHint: 'TRC20, quoted at checkout',
    amount: 'Amount (USD)',
    customAmount: 'Custom amount',
    minCard: 'Minimum $16',
    minCrypto: 'Minimum $10',
    cryptoRate: 'The USDT amount due is quoted at checkout; the USD amount above is what gets credited.',
    hostedCardTitle: 'Checkout',
    hostedCardLead: 'Card details, Apple Pay and Google Pay are all handled on that page; card numbers never reach this site.',
    hostedCryptoNote: 'Send to the address below or scan the QR code; credited once confirmed on chain.',
    cryptoRefund: 'Simulate abnormal payment · refund on chain',
    cryptoDone: 'Simulate on-chain credit',
    success: 'Simulate successful payment',
    fail: 'Simulate failed payment',
    failed: 'Payment failed and was not credited. Retry or cancel.',
    later: 'Later',
    pay: 'Pay',
    cancel: 'Cancel',
  },
}

export function TopupFlow({ lang, initialChannel = 'card', onClose, onCredit, onRefund }: {
  lang: Language
  initialChannel?: Channel
  onClose: () => void
  onCredit: (amount: number, channel: Channel) => void
  onRefund: () => void
}) {
  const t = copy[lang]
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [amount, setAmount] = useState(Math.max(25, MIN_TOPUP[initialChannel]))
  const [view, setView] = useState<'form' | 'hosted'>('form')
  const [stage, setStage] = useState<'idle' | 'failed'>('idle')

  const min = MIN_TOPUP[channel]
  const presets = [20, 50, 100, 200].filter(value => value >= min)
  const valid = amount >= min
  const crypto = channel === 'crypto'
  /* 演示报价：USDT≈USD，真实以收银台为准 */
  const quote = usdt(amount)

  const switchChannel = (next: Channel) => {
    setChannel(next)
    setAmount(value => Math.max(value, MIN_TOPUP[next]))
  }

  if (view === 'hosted') return <Overlay lang={lang} onClose={() => setView('form')} label={crypto ? 'USDT' : t.hostedCardTitle}>
    <div className={u.head}><h2>{crypto ? 'USDT · TRC20' : t.hostedCardTitle}</h2>
      <p>{crypto ? t.hostedCryptoNote : t.hostedCardLead}</p></div>
    <div className={u.body}>
      <div className={u.amountRow}><span>{t.amount}</span><strong>{money(amount)}</strong></div>
      {crypto
        ? <>
            <div className={u.cryptoBox}>
              <div className={u.qr} aria-hidden="true" />
              <div><strong>USDT · TRC20</strong><p>TQ5xDemoWalletAddress0000000000</p></div>
            </div>
            <p className={u.note}>{lang === 'zh' ? `应付约 ${quote}（以收银台报价为准）` : `About ${quote} due (quoted at checkout)`}</p>
          </>
        : <div className={u.skeletonRow} aria-hidden="true"><span /><span /><span /></div>}
      {stage === 'failed' && <p className={u.warn}>{t.failed}</p>}
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={() => setView('form')}>{t.cancel}</button>
      {crypto
        ? <>
            <button className={u.btnGhost} onClick={onRefund}>{t.cryptoRefund}</button>
            <button className={u.btnPrimary} onClick={() => onCredit(amount, channel)}>{t.cryptoDone}</button>
          </>
        : stage === 'failed'
          ? <button className={u.btnPrimary} onClick={() => setStage('idle')}>{t.success}</button>
          : <>
              <button className={u.btnGhost} onClick={() => setStage('failed')}>{t.fail}</button>
              <button className={u.btnPrimary} onClick={() => onCredit(amount, channel)}>{t.success}</button>
            </>}
    </div>
  </Overlay>

  return <Overlay lang={lang} onClose={onClose} label={t.title}>
    <div className={u.head}><h2>{t.title}</h2><p>{t.lead}</p></div>
    <div className={u.body}>
      <span className={u.fieldLabel}>{t.method}</span>
      <div className={u.methodGrid}>
        {(['card', 'crypto'] as Channel[]).map(key => <button key={key} type="button" className={u.method}
          data-active={channel === key} aria-pressed={channel === key} onClick={() => switchChannel(key)}>
          <b>{key === 'card' ? t.methodCard : t.methodCrypto}</b>
          <span>{key === 'card' ? t.methodCardHint : t.methodCryptoHint}</span>
        </button>)}
      </div>

      <span className={u.fieldLabel}>{t.amount}</span>
      <div className={u.presets}>{presets.map(value => <button key={value} className={u.preset} data-active={amount === value}
        onClick={() => setAmount(value)}>{money(value).replace('.00', '')}</button>)}</div>
      <label className={u.customRow}>
        <span className={u.customLabel}>{t.customAmount}</span>
        <span className={u.customField}>
          <em aria-hidden="true">$</em>
          <input className={u.input} type="number" min={min} inputMode="decimal" value={amount}
            aria-label={t.amount}
            onChange={event => setAmount(Math.max(0, Number(event.target.value) || 0))} />
        </span>
      </label>
      <p className={u.note}>{crypto ? t.minCrypto : t.minCard}</p>
      {crypto && <p className={u.note}>{t.cryptoRate}</p>}
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={onClose}>{t.later}</button>
      <button className={u.btnPrimary} disabled={!valid} onClick={() => { setStage('idle'); setView('hosted') }}>{t.pay} {money(amount)}</button>
    </div>
  </Overlay>
}
