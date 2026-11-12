import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import AdminApp from './AdminPage'
import type { Language } from './content'
import './global.css'

/* 运营后台独立入口（admin.html）：与对客官网（main.tsx）各自挂载，
   会话经 localStorage 同 origin 共享——官网登录过运营账号，此处直达。 */
function AdminRoot() {
  const [lang, setLang] = useState<Language>('zh')
  useEffect(() => { document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en' }, [lang])
  return <AdminApp lang={lang} onToggleLang={() => setLang(value => value === 'zh' ? 'en' : 'zh')} />
}

/* 后台是控制台式页面，不套对客官网 body 的 1120px 最小宽（global.css）
   ——data-view 标记让窄屏/media 查询与登录门都按真实视口走 */
document.body.dataset.view = 'admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AdminRoot /></React.StrictMode>,
)
