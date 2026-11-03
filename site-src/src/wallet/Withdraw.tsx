/* ============================================================================
   提现与收款账户（宿主收益页，演示态）
   · 法币出金经 Airwallex（同名银行账户），链上提现经 Infini（自有钱包）
   · 提现 = 申请制：金额 ≥$20 且不超过对应池可提现余额，二次验证后提交
   · 费用不在页面预估：到账金额与费用由通道在提交后返回
   ========================================================================== */

import { useState } from 'react'
import type { Language } from '../content'
import { CHANNEL, MIN_PAYOUT, RAIL_LABEL, money } from './store'
import type { PayoutAccount, Rail, WalletState } from './store'
import { Overlay } from './ui'
import u from './ui.module.css'

const copy = {
  zh: {
    wdTitle: '提现',
    wdLead: '选择通道与收款账户；法币仅同名银行账户，链上仅自有钱包。',
    wdRailHint: '法币出金经 Airwallex，链上提现经 Infini；两条通道不会调用对方余额。',
    wdFee: '到账金额与费用在提交后由通道返回，本页不预估。',
    wdAmount: '提现金额',
    wdAll: '全部',
    wdAccount: '收款账户',
    wdNoAccount: '该通道尚未绑定收款账户',
    wdAdd: '添加收款账户',
    wdVerify: '出金二次验证',
    wdCodeSent: '验证码已发送至账号邮箱',
    wdCode: '验证码',
    wdCodeDemo: '演示验证码：123456',
    wdSubmit: '验证并提交',
    wdCodeBad: '请输入 6 位数字验证码',
    wdCodeWrong: '验证码错误，请重试',
    wdInvalid: '提现金额需 ≥$20 且不超过可提现余额',
    wdNoVerify: '该账户未通过同名核验，暂不可出金',
    wdPending: '已有出金申请在途，完成后可再次提现',
    acctTitle: '收款账户',
    acctFiat: '法币 · 同名银行账户',
    acctCrypto: '链上 · 自有钱包',
    acctHolder: '账户名',
    acctNo: '银行账号',
    acctAddr: '钱包地址',
    acctChain: '网络',
    acctSave: '保存并核验',
    acctVerify: '保存时自动核验同名',
    acctSameName: '仅支持同名账户出金：账户名须与实名主体一致。',
    acctWalletNote: '链上钱包不做同名核验，地址归属由本人承担。',
    verifiedMatch: '完全匹配',
    verifiedPartial: '部分匹配',
    verifiedNo: '未匹配',
    cancel: '取消',
    withdraw: '提现',
  },
  en: {
    wdTitle: 'Withdraw',
    wdLead: 'Pick a channel and payout account: fiat only to a same-name bank account, on-chain only to your own wallet.',
    wdRailHint: 'Fiat payouts run through Airwallex, on-chain withdrawals through Infini; neither channel draws on the other’s balance.',
    wdFee: 'The received amount and fees are returned by the channel after submission; nothing is estimated here.',
    wdAmount: 'Withdrawal amount',
    wdAll: 'All',
    wdAccount: 'Payout account',
    wdNoAccount: 'No payout account on this channel',
    wdAdd: 'Add payout account',
    wdVerify: 'Step-up verification',
    wdCodeSent: 'A code was sent to your account email',
    wdCode: 'Verification code',
    wdCodeDemo: 'Demo code: 123456',
    wdSubmit: 'Verify and submit',
    wdCodeBad: 'Enter the 6-digit code',
    wdCodeWrong: 'Incorrect code, please retry',
    wdInvalid: 'Amount must be ≥$20 and within the withdrawable balance',
    wdNoVerify: 'This account has not passed the same-name check',
    wdPending: 'A payout is already in flight',
    acctTitle: 'Payout account',
    acctFiat: 'Fiat · same-name bank account',
    acctCrypto: 'On-chain · own wallet',
    acctHolder: 'Account name',
    acctNo: 'Account number',
    acctAddr: 'Wallet address',
    acctChain: 'Network',
    acctSave: 'Save and verify',
    acctVerify: 'Same-name check runs on save',
    acctSameName: 'Same-name accounts only: the account name must match your verified identity.',
    acctWalletNote: 'On-chain wallets skip the same-name check; address ownership is yours to bear.',
    verifiedMatch: 'Full match',
    verifiedPartial: 'Partial match',
    verifiedNo: 'Not matched',
    cancel: 'Cancel',
    withdraw: 'Withdraw',
  },
}

export function WithdrawModal({ lang, wallet, onClose, onSubmit, onManage }: {
  lang: Language
  wallet: WalletState
  onClose: () => void
  onSubmit: (rail: Rail, accountLabel: string, amount: number) => void
  onManage: () => void
}) {
  const t = copy[lang]
  const railText = RAIL_LABEL[lang]
  const accounts = wallet.accounts
  const payouts = wallet.payouts
  const avail = (rail: Rail) => {
    const frozen = payouts.filter(r => r.rail === rail && (r.status === 'scheduled' || r.status === 'pending') && !r.deducted).reduce((s, r) => s + r.amount, 0)
    return Math.max(0, +(wallet.earnings[rail] - wallet.held[rail] - frozen).toFixed(2))
  }

  const [rail, setRail] = useState<Rail>(accounts.some(a => a.rail === 'fiat') ? 'fiat' : 'crypto')
  const list = accounts.filter(account => account.rail === rail)
  const [accountId, setAccountId] = useState<string>(list[0]?.id ?? '')
  const [amount, setAmount] = useState(() => Math.min(MIN_PAYOUT, avail(rail)).toFixed(2))
  const [stage, setStage] = useState<'form' | 'verify'>('form')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const available = avail(rail)
  const account = list.find(item => item.id === accountId) ?? list[0]
  const value = Number(amount)
  const valid = Number.isFinite(value) && value >= MIN_PAYOUT && value <= available + 1e-9
  const verified = account?.verified === 'match'
  const inFlight = payouts.some(r => r.status === 'pending' || r.status === 'scheduled' || r.status === 'processing' || r.status === 'sent')

  const pickRail = (next: Rail) => {
    setRail(next)
    const nextList = accounts.filter(item => item.rail === next)
    setAccountId(nextList[0]?.id ?? '')
    setAmount(Math.min(MIN_PAYOUT, avail(next)).toFixed(2))
  }

  const confirm = () => {
    if (!/^\d{6}$/.test(code)) { setError(t.wdCodeBad); return }
    if (code !== '123456') { setError(t.wdCodeWrong); return }
    if (!account) return
    onSubmit(rail, `${account.label}${account.tail ? ` · •••• ${account.tail}` : ''}`, value)
    onClose()
  }

  return <Overlay lang={lang} onClose={onClose} label={stage === 'form' ? t.wdTitle : t.wdVerify}>
    <div className={u.head}><h2>{stage === 'form' ? `${t.wdTitle} · ${CHANNEL[rail]}` : t.wdVerify}</h2>
      <p>{stage === 'form' ? t.wdLead : t.wdCodeSent}</p></div>
    {stage === 'form' ? <>
      <div className={u.body}>
        <span className={u.fieldLabel}>{lang === 'zh' ? '通道' : 'Channel'}</span>
        <div className={u.tabs} role="tablist">
          {(['fiat', 'crypto'] as Rail[]).map(key => <button key={key} role="tab" aria-selected={rail === key} className={u.tab}
            data-active={rail === key} onClick={() => pickRail(key)}>
            {CHANNEL[key]} <b className={u.tabPool}>{railText[key]} {money(avail(key))}</b>
          </button>)}
        </div>
        <p className={u.note}>{t.wdRailHint}</p>

        <span className={u.fieldLabel}>{t.wdAmount}</span>
        <div className={u.amountInput}>
          <input className={u.input} type="number" min={MIN_PAYOUT} value={amount} aria-label={t.wdAmount}
            onChange={event => setAmount(event.target.value)} />
          <button className={u.miniBtn} onClick={() => setAmount(available.toFixed(2))}>{t.wdAll}</button>
        </div>
        <p className={u.note}>{t.wdFee}</p>

        <span className={u.fieldLabel}>{t.wdAccount}</span>
        {list.length === 0
          ? <div className={u.emptyBox}>
              <p>{t.wdNoAccount}</p>
              <button className={u.miniBtn} onClick={onManage}>{t.wdAdd}</button>
            </div>
          : <div className={u.accountList}>{list.map(item => <button key={item.id} className={u.account} data-active={account?.id === item.id}
              onClick={() => setAccountId(item.id)}>
              <span className={u.accountTop}><b>{item.label}</b>
                <span className={u.badge} data-tone={item.verified === 'match' ? 'ok' : item.verified === 'partial' ? 'warn' : 'bad'}>
                  {item.verified === 'match' ? t.verifiedMatch : item.verified === 'partial' ? t.verifiedPartial : t.verifiedNo}
                </span>
              </span>
              <span className={u.mono}>{item.rail === 'fiat' ? `${item.bank} · •••• ${item.tail}` : `${item.chain} · ${item.address}`}</span>
            </button>)}</div>}

        {account && !verified && <p className={u.warn}>{t.wdNoVerify}</p>}
        {available < MIN_PAYOUT && <p className={u.warn}>{t.wdInvalid}</p>}
        {inFlight && <p className={u.warn}>{t.wdPending}</p>}
      </div>
      <div className={u.foot}>
        <button className={u.btnGhost} onClick={onClose}>{t.cancel}</button>
        <button className={u.btnPrimary} disabled={!valid || !verified || !account} onClick={() => { setError(''); setStage('verify') }}>{t.withdraw}</button>
      </div>
    </> : <>
      <div className={u.body}>
        <div className={u.amountRow}><span>{t.wdAmount}</span><strong>{money(value)}</strong></div>
        <span className={u.fieldLabel}>{t.wdCode}</span>
        <input className={u.input} inputMode="numeric" maxLength={6} value={code} aria-label={t.wdCode}
          onChange={event => setCode(event.target.value.replace(/\D/g, ''))} />
        <p className={u.note}>{t.wdCodeDemo}</p>
        {error && <p className={u.warn} role="alert">{error}</p>}
      </div>
      <div className={u.foot}>
        <button className={u.btnGhost} onClick={() => setStage('form')}>{t.cancel}</button>
        <button className={u.btnPrimary} onClick={confirm}>{t.wdSubmit}</button>
      </div>
    </>}
  </Overlay>
}

export function AccountsModal({ lang, wallet, onClose, onSave }: {
  lang: Language
  wallet: WalletState
  onClose: () => void
  onSave: (account: PayoutAccount) => void
}) {
  const t = copy[lang]
  const [rail, setRail] = useState<Rail>('fiat')
  const [holder, setHolder] = useState('')
  const [number, setNumber] = useState('')
  const [chain, setChain] = useState('TRON')
  const [address, setAddress] = useState('')

  const walletOk = address.replace(/\s/g, '').length >= 20
  const bankOk = holder.trim().length > 1 && number.replace(/\D/g, '').length >= 6

  const save = () => {
    if (rail === 'crypto') {
      if (!walletOk) return
      onSave({ id: `pa-${Date.now()}`, rail: 'crypto', label: address.slice(0, 10) + '…', chain, address: address.trim(), tail: address.slice(-4), verified: 'match', isDefault: !wallet.accounts.some(a => a.rail === 'crypto') })
    } else {
      if (!bankOk) return
      const digits = number.replace(/\D/g, '')
      onSave({ id: `pa-${Date.now()}`, rail: 'fiat', label: holder.trim(), bank: 'DBS Bank', tail: digits.slice(-4), verified: 'match', isDefault: !wallet.accounts.some(a => a.rail === 'fiat') })
    }
    onClose()
  }

  const verifyLabel = (item: PayoutAccount) => item.verified === 'match' ? t.verifiedMatch : item.verified === 'partial' ? t.verifiedPartial : t.verifiedNo

  return <Overlay lang={lang} onClose={onClose} label={t.acctTitle}>
    <div className={u.head}><h2>{t.acctTitle} · {CHANNEL[rail]}</h2><p>{rail === 'fiat' ? t.acctSameName : t.acctWalletNote}</p></div>
    <div className={u.body}>
      <div className={u.tabs} role="tablist">
        {(['fiat', 'crypto'] as Rail[]).map(key => <button key={key} role="tab" aria-selected={rail === key} className={u.tab}
          data-active={rail === key} onClick={() => setRail(key)}>{CHANNEL[key]} <b className={u.tabPool}>{key === 'fiat' ? t.acctFiat : t.acctCrypto}</b></button>)}
      </div>

      {rail === 'fiat' ? <>
        <span className={u.fieldLabel}>{t.acctHolder}</span>
        <input className={u.input} value={holder} onChange={event => setHolder(event.target.value)} />
        <span className={u.fieldLabel}>{t.acctNo}</span>
        <input className={u.input} inputMode="numeric" value={number} onChange={event => setNumber(event.target.value)} />
        <p className={u.note}>{t.acctVerify}</p>
      </> : <>
        <span className={u.fieldLabel}>{t.acctChain}</span>
        <select className={u.input} value={chain} onChange={event => setChain(event.target.value)}>
          {['TRON', 'ETHEREUM', 'BNB_CHAIN', 'SOLANA'].map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <span className={u.fieldLabel}>{t.acctAddr}</span>
        <input className={u.input} value={address} onChange={event => setAddress(event.target.value)} placeholder="T..." />
      </>}

      <div className={u.accountList}>{wallet.accounts.map(item => <div key={item.id} className={u.account} data-static="true">
        <span className={u.accountTop}><b>{item.label}</b>
          <span className={u.badge} data-tone={item.verified === 'match' ? 'ok' : item.verified === 'partial' ? 'warn' : 'bad'}>{verifyLabel(item)}</span>
        </span>
        <span className={u.mono}>{item.rail === 'fiat' ? `${item.bank} · •••• ${item.tail}` : `${item.chain} · ${item.address}`}</span>
      </div>)}</div>
    </div>
    <div className={u.foot}>
      <button className={u.btnGhost} onClick={onClose}>{t.cancel}</button>
      <button className={u.btnPrimary} disabled={rail === 'fiat' ? !bankOk : !walletOk} onClick={save}>{t.acctSave}</button>
    </div>
  </Overlay>
}
