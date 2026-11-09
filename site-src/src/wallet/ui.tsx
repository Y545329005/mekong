/* ============================================================================
   资金两页共用控件（白底）：弹窗外壳、按钮、徽章、输入
   · 白区色板与算力市场一致：#fff 底 / #17212c 标题 / #34475a 正文 /
     #627386 次要 / #315f90 强调 / #dce2e8、#e1e6ec 描边
   · 弹窗用原生 <dialog>（可叠加在租用确认弹窗之上），Escape 与外点都可关闭
   ========================================================================== */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Language } from '../content'
import Icon from '../Icons'
import u from './ui.module.css'

export function Overlay({ lang, children, onClose, label }: { lang: Language; children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.showModal()
    return () => node.close()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return <dialog ref={ref} className={u.overlay} onClose={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    aria-label={label}>
    <button className={u.close} onClick={onClose} aria-label={lang === 'zh' ? '关闭' : 'Close'}>
      <Icon name="close" size={18} />
    </button>
    {children}
  </dialog>
}

export function Badge({ tone, children }: { tone: 'ok' | 'info' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
  return <span className={u.badge} data-tone={tone}>{children}</span>
}

/* 页码工具条（资金页 / 收益页共用）：上一页 / 第 x / y 页 / 下一页 + 总条数 */
export type PagerCopy = {
  total: (count: number) => string
  prev: string
  next: string
  pageOf: (page: number, pages: number) => string
  pagination: string
}

export function PageNav({ page, pages, count, t, onPage }: {
  page: number
  pages: number
  count?: number
  t: PagerCopy
  onPage: (next: number) => void
}) {
  return <div className={u.pager}>
    {count != null && <span className={u.pagerCount}>{t.total(count)}</span>}
    <nav className={u.pagerNav} aria-label={t.pagination}>
      <button type="button" className={u.pagerBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>{t.prev}</button>
      <span className={u.pagerPos} aria-live="polite">{t.pageOf(page, pages)}</span>
      <button type="button" className={u.pagerBtn} disabled={page >= pages} onClick={() => onPage(page + 1)}>{t.next}</button>
    </nav>
  </div>
}
