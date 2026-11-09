/* ============================================================================
   退出（资金页）：未消费余额按来源走两条机制
   · 卡充值的钱 → 原路退款（Refund / Partial Refund），只回原卡
   · USDT 充值的钱 → 链上提现到自己的钱包，按通道报价折算 USDT
   · 退款按支付单列额度与截止日：用户能看到「哪笔充值还能退多少」
   · 对客不出现通道名；只有「退回银行卡」「提到钱包」两个目的地
   ========================================================================== */

import { useState } from 'react'
import type { Language } from '../content'
import { MIN_REFUND, MIN_WITHDRAW, REFUND_COOLING_DAYS, cryptoWithdrawable, inFlightTotal, isRefundOpen, lotAvailable, money, stampFull } from './store'
import type { ExitRequest, Payment, WalletState } from './store'
import { Overlay } from './ui'
import u from './ui.module.css'

const copy = {
  zh: {
    title: '退回',
    lead: '卡充值原路退回银行卡；USDT 充值可提到你自己的链上钱包。',
    refundTitle: '退回原银行卡',
    refundMeta: (v: string, n: number) => `可退 ${v} · ${n} 笔充值`,
    withdrawTitle: '提到链上钱包',
    withdrawMeta: (v: string) => `可提 ${v}`,
    refundCooling: '充值满 7 天可退，随时申请，不设期限',
    withdrawHint: '到账 USDT，按通道报价',
    choosePayment: '选择要退的充值单',
    remaining: '可退',
    paid: '充值',
    limit: '最多可退',
    window: (from: string) => `${from} 起可退`,
    amount: '金额',
    all: '全部',
    address: '钱包地址',
    addressPlaceholder: 'T...',
    refundNote: '充值满 7 天后可申请；提交后原路退回，通常 1–3 个工作日到账，失败时金额回到余额。',
    withdrawNote: '单笔最低 $10.00；到账 USDT 与手续费以提交后通道报价为准。',
    invalidRefund: '金额需在可退范围内',
    invalidWithdraw: '提现金额需 ≥ $10.00 且不超过可提金额',
    invalidAddress: '请输入有效的钱包地址',
    submitRefund: '提交退回申请',
    submitWithdraw: '提交提现申请',
    cancel: '取消',
    inFlight: '已有一笔退回在处理中，完成后再提交。',
    noRefund: '没有可退的卡充值',
    noWithdraw: '没有可提的 USDT 充值',
  },
  en: {
    title: 'Refund or withdraw',
    lead: 'Card top-ups go back to the original card; USDT top-ups can be withdrawn to your own wallet.',
    refundTitle: 'Refund to the card',
    refundMeta: (v: string, n: number) => `${v} refundable · ${n} payments`,
    withdrawTitle: 'Withdraw to a wallet',
    withdrawMeta: (v: string) => `${v} available`,
    withdrawHint: 'Paid in USDT, quoted by the channel',
    refundCooling: 'Refundable 7 days after the top-up, no expiry',
    choosePayment: 'Choose the top-up to refund',
    remaining: 'Refundable',
    paid: 'Top-up',
    limit: 'Max refundable',
    window: (from: string) => `refundable from ${from}`,
    amount: 'Amount',
    all: 'All',
    address: 'Wallet address',
    addressPlaceholder: 'T...',
    refundNote: 'Available 7 days after the top-up. Refunds go back to the original card within 1–3 business days; a failed refund returns the amount to your balance.',
    withdrawNote: 'Minimum $10.00; the USDT received and the fee are quoted by the channel after submission.',
    invalidRefund: 'Enter an amount within the refundable range',
    invalidWithdraw: 'Amount must be at least $10.00 and within the available balance',
    invalidAddress: 'Enter a valid wallet address',
    submitRefund: 'Submit refund request',
    submitWithdraw: 'Submit withdrawal request',
    cancel: 'Cancel',
    inFlight: 'Another refund or withdrawal is still in progress.',
    noRefund: 'No card top-up can be refunded',
    noWithdraw: 'No USDT top-up can be withdrawn',
  },
}

const day = (at: number) => stampFull(at).slice(0, 10)

export function ExitModal({ lang, wallet, onClose, onRefund, onWithdraw }: {
  lang: Language
  wallet: WalletState
  onClose: () => void
  onRefund: (paymentId: string, amount: number) => void
  onWithdraw: (amount: number, address: string) => void
}) {
  const t = copy[lang]
  const lots = wallet.payments
    .filter(p => isRefundOpen(p) && lotAvailable(p) > 0)
    .sort((a, b) => b.at - a.at)
  const refundTotal = lots.reduce((sum, p) => sum + lotAvailable(p), 0)
  const withdrawTotal = cryptoWithdrawable(wallet)

  const [method, setMethod] = useState<'refund' | 'withdraw'>(refundTotal > 0 ? 'refund' : 'withdraw')
  const [paymentId, setPaymentId] = useState(lots[0]?.id ?? '')
  const lot = lots.find(p => p.id === paymentId) ?? lots[0]
  const lotMax = lot ? lotAvailable(lot) : 0
  const [amount, setAmount] = useState(() => (refundTotal > 0
    ? Math.max(MIN_REFUND, Math.min(refundTotal, lotMax))
    : Math.max(0, withdrawTotal)).toFixed(2))
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  const inFlight = inFlightTotal(wallet) > 0
  const value = Number(amount)

  const choosePayment = (payment: Payment) => {
    setPaymentId(payment.id)
    setAmount(Math.max(MIN_REFUND, lotAvailable(payment)).toFixed(2))
    setError('')
  }

  const chooseMethod = (next: 'refund' | 'withdraw') => {
    setMethod(next)
    setError('')
    setAmount(next === 'refund' ? Math.max(MIN_REFUND, lotMax).toFixed(2) : Math.max(MIN_WITHDRAW, withdrawTotal).toFixed(2))
  }

  const refundValid = method === 'refund' && lot && Number.isFinite(value) && value >= MIN_REFUND && value <= lotMax + 1e-9
  const withdrawValid = method === 'withdraw' && Number.isFinite(value) && value >= MIN_WITHDRAW && value <= withdrawTotal + 1e-9 && address.trim().length >= 20
  const valid = !inFlight && (refundValid || withdrawValid)

  const submit = () => {
    setError('')
    if (inFlight) { setError(t.inFlight); return }
    if (method === 'refund') {
      if (!refundValid || !lot) { setError(t.invalidRefund); return }
      onRefund(lot.id, value)
    } else {
      if (!Number.isFinite(value) || value < MIN_WITHDRAW || value > withdrawTotal + 1e-9) { setError(t.invalidWithdraw); return }
      if (address.trim().length < 20) { setError(t.invalidAddress); return }
      onWithdraw(value, address.trim())
    }
    onClose()
  }

  return <Overlay lang={lang} onClose={onClose} label={t.title}>
    <div className={u.head}><h2>{t.title}</h2><p>{t.lead}</p></div>
    <div className={u.body}>
      <div className={u.methodGrid}>
        <button type="button" className={u.method} data-active={method === 'refund'} aria-pressed={method === 'refund'}
          disabled={refundTotal <= 0} onClick={() => chooseMethod('refund')}>
          <b>{t.refundTitle}</b>
          <span>{refundTotal > 0 ? t.refundMeta(money(refundTotal), lots.length) : t.noRefund}</span>
          <em>{t.refundCooling}</em>
        </button>
        <button type="button" className={u.method} data-active={method === 'withdraw'} aria-pressed={method === 'withdraw'}
          disabled={withdrawTotal <= 0} onClick={() => chooseMethod('withdraw')}>
          <b>{t.withdrawTitle}</b>
          <span>{withdrawTotal > 0 ? t.withdrawMeta(money(withdrawTotal)) : t.noWithdraw}</span>
          {withdrawTotal > 0 && <em>{t.withdrawHint}</em>}
        </button>
      </div>

      {method === 'refund' ? <>
        <span className={u.fieldLabel}>{t.choosePayment}</span>
        <div className={u.accountList}>{lots.map(payment => <button key={payment.id} type="button" className={u.account}
          data-active={payment.id === lot?.id} onClick={() => choosePayment(payment)}>
          <span className={u.accountTop}><b>{t.paid} {money(payment.amount)}</b>
            <span className={u.badge} data-tone="ok">{t.remaining} {money(lotAvailable(payment))}</span>
          </span>
          <span className={u.mono}>{stampFull(payment.at)} · {t.window(day(payment.at + REFUND_COOLING_DAYS * 86400000))}</span>
        </button>)}</div>

        <span className={u.fieldLabel}>{t.amount}<em className={u.limit}>{t.limit} {money(lotMax)}</em></span>
        <div className={u.amountInput}>
          <input className={u.input} type="number" min={MIN_REFUND} max={lotMax} value={amount}
            aria-label={t.amount} onChange={event => setAmount(event.target.value)} />
          <button className={u.miniBtn} onClick={() => setAmount(lotMax.toFixed(2))}>{t.all}</button>
        </div>
        <p className={u.note}>{t.refundNote}</p>
      </> : <>
        <span className={u.fieldLabel}>{t.amount}<em className={u.limit}>{t.limit} {money(withdrawTotal)}</em></span>
        <div className={u.amountInput}>
          <input className={u.input} type="number" min={MIN_WITHDRAW} max={withdrawTotal} value={amount}
            aria-label={t.amount} onChange={event => setAmount(event.target.value)} />
          <button className={u.miniBtn} onClick={() => setAmount(withdrawTotal.toFixed(2))}>{t.all}</button>
        </div>
        <span className={u.fieldLabel}>{t.address}</span>
        <input className={u.input} value={address} placeholder={t.addressPlaceholder}
          aria-label={t.address} onChange={event => setAddress(event.target.value)} />
        <p className={u.note}>{t.withdrawNote}</p>
      </>}

      {inFlight && <p className={u.warn}>{t.inFlight}</p>}
      {error && <p className={u.warn} role="alert">{error}</p>}
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={onClose}>{t.cancel}</button>
      <button className={u.btnPrimary} disabled={!valid} onClick={submit}>
        {method === 'refund' ? t.submitRefund : t.submitWithdraw}
      </button>
    </div>
  </Overlay>
}

/* 供表格复用的状态文案 */
export function exitStageLabel(lang: Language, req: ExitRequest): { label: string; tone: 'ok' | 'info' | 'warn' | 'bad' } {
  if (req.status === 'pending') return { label: lang === 'zh' ? '待处理' : 'Pending', tone: 'warn' }
  if (req.status === 'processing') return { label: lang === 'zh' ? '处理中' : 'Processing', tone: 'info' }
  if (req.status === 'done') return { label: req.method === 'refund' ? (lang === 'zh' ? '已退回' : 'Refunded') : (lang === 'zh' ? '已到账' : 'Withdrawn'), tone: 'ok' }
  return { label: lang === 'zh' ? '失败' : 'Failed', tone: 'bad' }
}
