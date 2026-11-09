import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Language } from './content'
import Icon from './Icons'
import styles from './AuthGate.module.css'

/* ============================================================================
   站内账号层（演示态）
   · 资金属账号：余额/收益/提现按邮箱隔离，未登录不展示任何金额
   · 演示登录：邮箱 + 任意 6 位数字，不发真实邮件；会话存本机 localStorage
   · 只做「谁能看到资金」这一层，不做真实鉴权（真实产品接后端会话）
   ========================================================================== */

export type AccountRole = 'tenant' | 'host'
export type Account = { email: string; name: string; since: number; role: AccountRole }

const SESSION_KEY = 'mk-site-session'
const AUTH_EVENT = 'mk-site-auth'
const DEMO_EMAIL = 'demo@demo.dev'

export function readSession(): Account | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Account>
    if (!parsed || typeof parsed.email !== 'string' || !parsed.email.includes('@')) return null
    // 角色：demo 账号是宿主（看收益），其余默认租客（看资金）
    return { email: parsed.email, name: parsed.name || parsed.email.split('@')[0], since: Number(parsed.since) || Date.now(), role: parsed.role === 'host' ? 'host' : 'tenant' }
  } catch {
    return null
  }
}

function writeSession(account: Account | null) {
  try {
    if (account) localStorage.setItem(SESSION_KEY, JSON.stringify(account))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 存储不可用（隐私模式）时按未登录处理 */
  }
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function useSession() {
  const [account, setAccount] = useState<Account | null>(readSession)
  useEffect(() => {
    const sync = () => setAccount(readSession())
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const signIn = (email: string) => {
    const normalized = email.trim().toLowerCase()
    writeSession({ email: normalized, name: normalized.split('@')[0], since: Date.now(), role: normalized === DEMO_EMAIL ? 'host' : 'tenant' })
  }
  const signOut = () => writeSession(null)
  // 角色是「这次要看哪个账本」，不是账号的固有属性：同一账号既可能租用也可能出租。
  const switchRole = (role: AccountRole) => { if (account) writeSession({ ...account, role }) }
  return { account, signIn, signOut, switchRole }
}

const copy = {
  zh: {
    login: '登录',
    loginTitle: '登录 Mekong 账户',
    loginLead: '资金随账户走：登录后才能查看余额、充值记录、收益与退回申请。',
    emailLabel: '邮箱',
    emailPlaceholder: 'you@company.com',
    sendCode: '发送验证码',
    codeLabel: '验证码',
    codePlaceholder: '6 位数字',
    codeLead: (email: string) => `验证码已发送至 ${email}`,
    demoCode: '演示环境：任意 6 位数字均可通过，不发送真实邮件',
    resend: '重新发送',
    back: '换个邮箱',
    submit: '登录',
    errEmail: '请输入有效的邮箱地址',
    errCode: '请输入 6 位数字验证码',
    signedIn: '已登录为',
    signOut: '退出登录',
    gateTitle: '登录后查看账户资金',
    gateLead: '资金绑定在账户上：余额、收益与退回记录都属于当前登录的账户，未登录时不展示任何金额。',
    gatePoints: [
      '同一浏览器换账号登录，看到的是另一套余额与流水',
      '一个 USD 余额，银行卡与 USDT 只是入金方式',
      '演示账号 demo@demo.dev 预置了演示资金与退回记录',
    ],
    demoAccount: '用演示账号登录',
  },
  en: {
    login: 'Sign in',
    loginTitle: 'Sign in to Mekong',
    loginLead: 'Funds belong to an account: sign in to see your balance, top-ups, earnings and withdrawals.',
    emailLabel: 'Email',
    emailPlaceholder: 'you@company.com',
    sendCode: 'Send code',
    codeLabel: 'Verification code',
    codePlaceholder: '6 digits',
    codeLead: (email: string) => `A code was sent to ${email}`,
    demoCode: 'Demo: any 6 digits pass, no real email is sent',
    resend: 'Resend',
    back: 'Change email',
    submit: 'Sign in',
    errEmail: 'Enter a valid email address',
    errCode: 'Enter the 6-digit code',
    signedIn: 'Signed in as',
    signOut: 'Sign out',
    gateTitle: 'Sign in to see your funds',
    gateLead: 'Funds are bound to accounts: balances, earnings and withdrawals belong to the signed-in account. No amounts are shown otherwise.',
    gatePoints: [
      'Signing in with another account shows a different set of balances and records',
      'Fiat and crypto balances are kept apart; withdrawals never cross assets',
      'The demo account demo@demo.dev comes with prefilled funds and withdrawals',
    ],
    demoAccount: 'Use the demo account',
  },
}

/** 登录表单：邮箱 → 验证码（演示任意 6 位） */
export function LoginForm({ lang, onSignIn }: { lang: Language; onSignIn: (email: string) => void }) {
  const t = copy[lang]
  const [step, setStep] = useState<0 | 1>(0)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    if (!validEmail) {
      setError(t.errEmail)
      return
    }
    setError('')
    setCode('')
    setStep(1)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError(t.errCode)
      return
    }
    setError('')
    onSignIn(email.trim())
  }

  return <div className={styles.panel}>
    <h2 className={styles.panelTitle}>{t.loginTitle}</h2>
    <p className={styles.panelLead}>{step === 0 ? t.loginLead : t.codeLead(email.trim())}</p>
    {step === 0
      ? <form className={styles.form} onSubmit={send} noValidate>
          <label className={styles.field}>
            <span>{t.emailLabel}</span>
            <input className={styles.input} type="email" autoComplete="email" value={email} placeholder={t.emailPlaceholder}
              onChange={event => { setEmail(event.target.value); setError('') }} />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.submit} type="submit">{t.sendCode}<Icon name="arrow" size={16} /></button>
            <button className={styles.ghost} type="button" onClick={() => { setEmail('demo@demo.dev'); setError('') }}>{t.demoAccount}</button>
          </div>
        </form>
      : <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.field}>
            <span>{t.codeLabel}</span>
            <input className={`${styles.input} ${styles.code}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={code} placeholder={t.codePlaceholder} autoFocus
              onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} />
          </label>
          <p className={styles.hint}>{t.demoCode}</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.submit} type="submit">{t.submit}<Icon name="arrow" size={16} /></button>
            <button className={styles.ghost} type="button" onClick={() => { setStep(0); setError('') }}>{t.back}</button>
          </div>
        </form>}
  </div>
}

/** 顶栏「登录」弹窗 */
export function LoginDialog({ open, lang, onClose, onSignIn }: { open: boolean; lang: Language; onClose: () => void; onSignIn: (email: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) node.showModal()
    else if (!open && node.open) node.close()
  }, [open])
  return <dialog ref={ref} className={styles.dialog} onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    aria-label={copy[lang].login}>
    <button className={styles.close} onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}><Icon name="close" size={20} /></button>
    {open && <div className={styles.dialogBody}>
      <LoginForm lang={lang} onSignIn={email => { onSignIn(email); onClose() }} />
    </div>}
  </dialog>
}

/** 资金/收益页未登录态：只说明「为什么看不到」，不给任何金额；标题随页面传入 */
export function WalletLocked({ lang, onSignIn, title }: { lang: Language; onSignIn: (email: string) => void; title: string }) {
  const t = copy[lang]
  return <div className={styles.locked} data-view="wallet-locked">
    <div className={styles.lockedShell}>
      <header className={styles.lockedHead}>
        <p className={styles.eyebrow}>MEKONG GPU CLOUD</p>
        <h1>{title}</h1>
        <p className={styles.lockedLead}>{t.gateLead}</p>
      </header>
      <div className={styles.lockedGrid}>
        <section className={styles.lockedNote} aria-labelledby="wallet-gate-title">
          <span className={styles.lockMark} aria-hidden="true"><Icon name="chip" size={18} /></span>
          <h2 id="wallet-gate-title">{t.gateTitle}</h2>
          <ul className={styles.points}>{t.gatePoints.map(point => <li key={point}>{point}</li>)}</ul>
        </section>
        <LoginForm lang={lang} onSignIn={onSignIn} />
      </div>
    </div>
  </div>
}
