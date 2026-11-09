import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { copy, regions, history } from './content'
import type { Copy, Gpu, Language, Region } from './content'
import Icon from './Icons'
import { HomeSections, HomeFooter, jumpTo } from './HomeSections'
import type { ModalState, DialogState } from './types'
import MarketPage, { ResourceDetail } from './MarketPage'
import SalesPage from './SalesPage'
import RentalPage from './RentalPage'
import BusinessPage from './BusinessPages'
import WalletPage from './WalletPage'
import EarningsPage from './EarningsPage'
import InstancesPage from './InstancesPage'
import MachinesPage from './MachinesPage'
import { useSession, LoginDialog } from './AuthGate'
import type { Account } from './AuthGate'
import type { BusinessKind } from './BusinessPages'
import styles from './App.module.css'
import { getHomeMarket } from './homeMarket'
import { useLiveTick } from './live'

const price=(value:number)=>`$${value.toFixed(2)}`

function Navigation({lang,t,browse,open,toggleLanguage,funds,account,login,signOut,switchRole,goto}:{lang:Language;t:Copy;browse:()=>void;open:(modal:ModalState)=>void;toggleLanguage:()=>void;funds:()=>void;account:Account|null;login:()=>void;signOut:()=>void;switchRole:(role:'tenant'|'host')=>void;goto:(page:'instances'|'machines')=>void}) {
  function action(index:number) {
    if(index===0)open({type:'rent'})
    else if(index===1)browse()
    else open({type:'inquiry'})
  }
  // 账号是 header 里唯一内容可变的实体：把邮箱与退出收进菜单后，一级行只剩固定宽度元素，
  // 语言切换钉在最右就不再随邮箱长短漂移。
  const [accountOpen,setAccountOpen]=useState(false),accountMenu=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!accountOpen)return
    const dismiss=(event:PointerEvent)=>{if(!accountMenu.current?.contains(event.target as Node))setAccountOpen(false)}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setAccountOpen(false);accountMenu.current?.querySelector<HTMLButtonElement>('button')?.focus()}}
    document.addEventListener('pointerdown',dismiss)
    document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape)}
  },[accountOpen])
  return <header className={styles.header}><div className={styles.headerInner}>
    <a href="#main" className={styles.logo} aria-label="Mekong Supercompute"><img src={`${import.meta.env.BASE_URL}assets/mekong-supercompute-white.svg`} alt="Mekong Supercompute" width="148" height="52"/></a>
    <nav aria-label={lang==='zh'?'主导航':'Main navigation'} className={styles.navigation}>{t.nav.map((label,index)=><div key={label} className={styles.navItem}><button onClick={()=>action(index)}>{label}</button></div>)}</nav>
    <div className={styles.headerActions}>{account?<><button className={`${styles.salesButton} ${styles.funds}`} onClick={()=>goto(account.role==='host'?'machines':'instances')} title={account.role==='host'?(lang==='zh'?'我上架的机器':'My machines'):(lang==='zh'?'我开通的实例':'My instances')}>{account.role==='host'?(lang==='zh'?'机器':'Machines'):(lang==='zh'?'实例':'Instances')}</button><button className={`${styles.salesButton} ${styles.funds}`} onClick={funds}>{account.role==='host'?(lang==='zh'?'收益':'Earnings'):(lang==='zh'?'资金':'Funds')}</button></>:<button className={styles.salesButton} onClick={login}>{lang==='zh'?'登录':'Sign in'}</button>}{account&&<div className={styles.accountMenu} ref={accountMenu}><button type="button" className={styles.accountTrigger} aria-haspopup="menu" aria-expanded={accountOpen} aria-label={lang==='zh'?'账号菜单':'Account menu'} title={account.email} onClick={()=>setAccountOpen(current=>!current)}><Icon name="user" size={15}/><Icon name="chevron" size={11}/></button>{accountOpen&&<div className={styles.accountPanel} role="menu"><span className={styles.accountPanelEmail} title={account.email}>{account.email}</span><span className={styles.accountPanelRole}>{lang==='zh'?'当前视角':'View as'} · {account.role==='host'?(lang==='zh'?'出租（宿主）':'Host'):(lang==='zh'?'租用（租客）':'Tenant')}</span><button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);switchRole(account.role==='host'?'tenant':'host')}}>{account.role==='host'?(lang==='zh'?'切换为租用视角':'Switch to tenant view'):(lang==='zh'?'切换为出租视角':'Switch to host view')}</button><button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);signOut()}}>{lang==='zh'?'退出登录':'Sign out'}</button></div>}</div>}<button className={styles.language} onClick={toggleLanguage} aria-label={lang==='zh'?'Switch to English':'切换为中文'}><Icon name="globe" size={15}/>{lang==='zh'?'EN':'中文'}</button></div>
  </div></header>
}

function Background() {
  const video=useRef<HTMLVideoElement>(null)
  useEffect(()=>{
    const element=video.current
    if(!element)return
    const container=element.parentElement!
    // Match the original canvas geometry; cover would enlarge and crop the globe.
    const resize=()=>{
      const {width,height}=container.getBoundingClientRect()
      const mobile=width<800
      const radius=mobile?Math.min(width*.65,height*.31):Math.min(width*.285,height*.425)
      const scale=radius/459
      container.style.setProperty('--motion-width',`${1920*scale}px`)
      container.style.setProperty('--motion-height',`${1080*scale}px`)
      container.style.setProperty('--motion-left',`${width*(mobile?.78:.735)-1411.2*scale}px`)
      container.style.setProperty('--motion-top',`${height*(mobile?.66:.49)-529.2*scale}px`)
    }
    const sizing=new ResizeObserver(resize)
    sizing.observe(container)
    resize()
    const preference=matchMedia('(prefers-reduced-motion: reduce)')
    let visible=true
    const sync=()=>{
      if(preference.matches||document.hidden||!visible)element.pause()
      else element.play().catch(()=>{})
    }
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()})
    observer.observe(element)
    document.addEventListener('visibilitychange',sync)
    preference.addEventListener('change',sync)
    sync()
    return()=>{sizing.disconnect();observer.disconnect();element.pause();document.removeEventListener('visibilitychange',sync);preference.removeEventListener('change',sync)}
  },[])
  const poster=`${import.meta.env.BASE_URL}assets/hero-motion.webp`
  return <div className={styles.background} aria-hidden="true"><img src={poster} alt=""/><video ref={video} src={`${import.meta.env.BASE_URL}assets/hero-motion.mp4`} poster={poster} autoPlay muted loop playsInline preload="metadata"/></div>
}

function Hero({t,search}:{t:Copy;search:(query:string)=>void}) {
  const [query,setQuery]=useState('')
  return <section className={styles.hero} aria-labelledby="hero-title"><div className={styles.heroInner}>
    <h1 id="hero-title">{t.heading[0]}<br/>{t.heading[1]}</h1><p className={styles.heroDescription}>{t.intro}<br/>{t.detail}</p>
    <form className={styles.searchBar} onSubmit={e=>{e.preventDefault();search(query)}} role="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchLabel}/><button type="submit">{t.browse}<Icon name="arrow" size={17}/></button></form>
  </div></section>
}

function Sparkline({gpu,t,period=7,entries:provided,decorative=false}:{gpu:Gpu;t:Copy;period?:7|30;entries?:{date:string;price:number}[];decorative?:boolean}) {
  const [point,setPoint]=useState<number|null>(null)
  const entries=provided??history(gpu,period),values=entries.map(entry=>entry.price),min=Math.min(...values)-.025,max=Math.max(...values)+.025
  const x=(i:number)=>5+i*120/(entries.length-1),y=(p:number)=>37-(p-min)/(max-min)*29
  const points=entries.map((entry,i)=>`${x(i)},${y(entry.price)}`).join(' ')
  return <div className={styles.sparkline}><svg viewBox="0 0 130 43" role={decorative?undefined:"group"} aria-hidden={decorative||undefined} aria-label={decorative?undefined:`${gpu.name} ${t.trend}`}><path d="M5 38H125" stroke="currentColor" opacity=".14"/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round"/>
    {entries.map((entry,i)=><g key={entry.date} tabIndex={decorative?-1:0} role={decorative?undefined:"img"} aria-label={`${entry.date}: ${price(entry.price)} ${t.hour}`} onFocus={()=>setPoint(i)} onBlur={()=>setPoint(null)} onMouseEnter={()=>setPoint(i)} onMouseLeave={()=>setPoint(null)}><rect x={x(i)-60/(entries.length-1)} y="0" width={120/(entries.length-1)} height="43" fill="transparent"/>{((point===null&&i===entries.length-1)||point===i)&&<circle cx={x(i)} cy={y(entry.price)} r="2.6" fill="currentColor"/>}</g>)}
    </svg>{point!==null&&<div className={styles.chartTooltip} role="tooltip"><span>{entries[point].date}</span><strong>{price(entries[point].price)}</strong><small>{t.tooltip} · {t.hour}</small></div>}</div>
}

function MarketBand({t,lang,marketRef,open}:{t:Copy;lang:Language;marketRef:RefObject<HTMLElement|null>;open:(modal:ModalState)=>void}) {
  const {inventory,featured,totals:data}=getHomeMarket()
  const labels=lang==='zh'
  const viewport=useRef<HTMLDivElement>(null)
  const [running,setRunning]=useState(false)
  useEffect(()=>{
    const element=viewport.current
    if(!element)return
    const preference=matchMedia('(prefers-reduced-motion: reduce)')
    let visible=false
    const sync=()=>setRunning(visible&&!document.hidden&&!preference.matches)
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()},{threshold:.05})
    observer.observe(element)
    document.addEventListener('visibilitychange',sync)
    preference.addEventListener('change',sync)
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);preference.removeEventListener('change',sync)}
  },[])
  const quote=(gpu:Gpu,duplicate:boolean)=>{
    const stock=inventory.find(row=>row.gpuId===gpu.id)
    const entries=history(gpu,7)
    // 起价只在「现在能租」时成立；全部租出的型号仍显示参考价，但必须与另一档文案区分开，
    // 否则访客会按一个租不到的价去比价（实测：RTX 5080 挂牌 $0.29、可租 0 张）。
    const available=stock?.available??0, total=stock?.total??0
    const last=total?entries.at(-1):undefined
    const chartCopy={...t,trend:labels?'7日价格走势':'7-day price history',tooltip:labels?'每日挂牌价':'Daily listing price'}
    return <a key={gpu.id} className={styles.quote} href={`#/market?view=prices&query=${encodeURIComponent(gpu.name)}`} tabIndex={duplicate?-1:0} aria-label={`${gpu.name} · ${labels?'查看价格与行情':'View prices and market trends'}`}>
      <div className={styles.quoteHeader}><span className={styles.quoteModel}>{gpu.name}<Icon name="diagonal" size={12}/></span><span>{labels?'7日':'7D'}</span></div>
      <div className={styles.quotePrice}><div><span className={styles.from}>{labels?(available?'挂牌起价':'参考价'):(available?'Listing from':'Reference')}</span><strong>{last?price(last.price):'—'}</strong><span className={styles.priceUnit}>{!last?(labels?'联系销售询价':'Contact sales'):available?t.hour:(labels?'已租满':'Rented out')}</span></div>{last&&entries.length>=2?<Sparkline gpu={gpu} t={chartCopy} entries={entries} decorative/>:<span className={styles.missingHistory}>{labels?'暂无报价':'No quote'}</span>}</div>
      <div className={styles.quoteSupply}>{stock&&<><span><i/>{t.available}<b>{stock.available}</b></span><span>{t.rented}<b>{stock.rented}</b></span><span>GPU<b>{stock.total} {labels?'':'GPUs'}</b></span></>}</div>
    </a>
  }
  return <section className={styles.marketBand} ref={marketRef} tabIndex={-1} aria-labelledby="market-title" id="market">
    <div className={styles.marketTop}><div className={styles.marketLabel}><h2 id="market-title"><button className={styles.marketEntry} onClick={()=>open({type:'market',query:'',tab:'prices'})}>{t.market}<Icon name="arrow" size={17}/></button></h2></div>
      <div className={styles.overview} aria-label={t.overview}><span>{t.total}<strong>{data.total}</strong>{labels?'':'GPUs'}</span><span>{t.rented}<strong>{data.rented}</strong></span><span><i className={styles.availableDot}/>{t.available}<strong>{data.available}</strong></span></div>
    </div>
    <div className={styles.ticker} ref={viewport} data-running={running} aria-label={labels?'GPU 行情轮播':'GPU market carousel'}><div className={styles.tickerTrack} style={{animationDuration:`${featured.length*10}s`}}>{[false,true].map(duplicate=><div key={String(duplicate)} className={styles.tickerGroup} aria-hidden={duplicate||undefined}>{featured.map(gpu=>quote(gpu,duplicate))}</div>)}</div></div>
  </section>
}

function Dialog({modal,t,lang,close}:{modal:DialogState;t:Copy;lang:Language;close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{if(modal&&!ref.current?.open)ref.current?.showModal();else if(!modal&&ref.current?.open)ref.current.close()},[modal])
  return <dialog ref={ref} className={`${styles.dialog} ${modal?.type==='resource'?styles.marketDialog:''}`} onClose={close} onClick={e=>{if(e.target===e.currentTarget)close()}} aria-labelledby="dialog-title" aria-describedby="dialog-description">
    {modal&&<div className={styles.dialogContent}><button className={styles.closeButton} onClick={close} aria-label={t.close}><Icon name="close" size={22}/></button><span className={styles.dialogEyebrow}>Mekong Supercompute</span>{modal.type==='resource'?<ResourceDetail key={`${modal.gpuId}-${modal.region}`} lang={lang} gpuId={modal.gpuId} region={modal.region}/>:<><h2 id="dialog-title">{modal.title}</h2><p id="dialog-description">{modal.description}</p><ul className={styles.guideList}>{modal.points.map(point=><li key={point}>{point}</li>)}</ul><button className={styles.primaryButton} onClick={close}>{t.understood}<Icon name="arrow" size={17}/></button></>}</div>}
  </dialog>
}


type PageRoute={page:'home'|'rent'|'market'|'contact-sales'|'wallet'|'earnings'|'instances'|'machines'|BusinessKind;query:string;region:Region;view:'supply'|'prices'|'geography'}
const pages=['rent','market','contact-sales','serverless','clusters','wallet','earnings','instances','machines'] as const
const archivedRoutes=new Set(['hosting','datacenters','providers','developers','developer','developer-tools','docs','api','templates','about','company'])
function readRoute():PageRoute {
 const [path,query]=window.location.hash.slice(1).split('?'), params=new URLSearchParams(query||'')
 let name=path.replace(/^\//,'')
 if(name==='enterprise'){name='contact-sales';window.history.replaceState({},'','#/contact-sales')}
 else if(archivedRoutes.has(name)){name='home';window.history.replaceState({},'','#main')}
 const page=pages.includes(name as typeof pages[number])?name as typeof pages[number]:'home'
 return {page,query:params.get('query')||'',region:regions.some(item=>item.id===params.get('region'))?params.get('region') as Region:'all',view:params.get('view')==='geography'?'geography':params.get('view')==='supply'?'supply':'prices'}
}
export default function App() {
 const [lang,setLang]=useState<Language>('zh'),[modal,setModal]=useState<DialogState>(null),[route,setRoute]=useState<PageRoute>(readRoute),[scrolled,setScrolled]=useState(false)
 // 资金属账号：会话在本机（演示态），未登录时资金页只给登录门
 const {account,signIn,signOut,switchRole}=useSession(),[loginOpen,setLoginOpen]=useState(false)
 // 每 10s 拉一次实时聚合（可租数/挂牌价/日期轴），数值本身按 20s/60s 桶演进，页面隐藏时暂停。
 useLiveTick()
 const marketRef=useRef<HTMLElement>(null),t=copy[lang],destination=useRef<string|null>(null)
 useEffect(()=>{document.documentElement.lang=lang==='zh'?'zh-CN':'en';const labels=lang==='zh'?{'home':'全球算力，触手可及','rent':'算力市场','market':'价格与行情','contact-sales':'企业算力与联系销售','serverless':'无服务器推理','clusters':'GPU 集群','wallet':'资金','earnings':'收益','instances':'实例','machines':'我的机器'}:{'home':'Global compute. Within reach.','rent':'Rent GPUs','market':'Market pricing','contact-sales':'Enterprise Compute & Contact Sales','serverless':'Serverless','clusters':'GPU clusters','wallet':'Funds','earnings':'Earnings','instances':'Instances','machines':'Machines'};document.title=`${labels[route.page as keyof typeof labels] ?? 'Mekong'} | Mekong Supercompute`},[lang,route.page])
 useEffect(()=>{const update=()=>setScrolled(window.scrollY>60);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update)},[])
 useEffect(()=>{const update=()=>{const next=readRoute();destination.current=next.page==='home'?(window.location.hash.slice(1)||'main'):next.page==='market'&&next.query?'gpu-quotes':'top';setRoute(next);setModal(null)};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update)},[])
 useEffect(()=>{if(!destination.current)return;const id=destination.current;destination.current=null;if(id==='top')window.scrollTo({top:0});else jumpTo(id)},[route])
 const navigate=(page:PageRoute['page'],params:Partial<PageRoute>={})=>{
  const request={page,query:'',region:'all',view:'prices',...params} as PageRoute
  const search=new URLSearchParams({...request.query?{query:request.query}:{},...request.region!=='all'?{region:request.region}:{},...page==='market'?{view:request.view}:{}})
  window.history.pushState({},'',page==='home'?'#main':`#/${page}${search.size?'?'+search:''}`);destination.current=page==='market'&&request.view==='geography'?'locations':page==='market'&&request.query?'gpu-quotes':'top';setRoute(request);setModal(null)
 }
 const open=(next:ModalState)=>{
  if(next?.type==='inquiry')navigate('contact-sales')
  else if(next?.type==='page')navigate(next.page)
  else if(next?.type==='rent'||next?.type==='market'){
   const entered=next.query?.trim()||'',normalized=entered.toLowerCase().replace(/\s/g,'')
   const searchedRegion=regions.slice(1).find(item=>normalized===item.id||normalized.includes(item.zh)||normalized.includes(item.en.toLowerCase().replace(/\s/g,'')))
   const query=searchedRegion?entered.replace(new RegExp(searchedRegion.zh,'i'),'').replace(new RegExp(searchedRegion.en,'i'),'').replace(new RegExp(`^${searchedRegion.id}$`,'i'),'').trim():entered
   navigate(next.type==='rent'?'rent':'market',{query,region:searchedRegion?.id??next.region??'all',view:next.type==='market'?next.tab:'supply'})
  }else setModal(next)
 }
 const browse=()=>open({type:'market',query:'',tab:'prices'})
 return <div className={styles.page} lang={lang==='zh'?'zh-CN':'en'} data-language={lang} data-view={route.page} data-scrolled={route.page!=='home'||scrolled}><a className={styles.skipLink} href="#main" onClick={event=>{event.preventDefault();document.getElementById('main')?.focus();window.scrollTo({top:0})}}>{t.skip}</a><Navigation lang={lang} t={t} browse={browse} open={open} funds={()=>navigate(account?.role==='host'?'earnings':'wallet')} account={account} login={()=>setLoginOpen(true)} signOut={signOut} goto={page=>navigate(page)} switchRole={role=>{switchRole(role);navigate(role==='host'?'earnings':'wallet')}} toggleLanguage={()=>setLang(value=>value==='zh'?'en':'zh')}/><main id="main" tabIndex={-1}>{route.page==='contact-sales'?<SalesPage lang={lang}/>:route.page==='rent'?<RentalPage key={`${route.query}-${route.region}`} lang={lang} query={route.query} initialRegion={route.region} open={open} account={account} requireSignIn={()=>setLoginOpen(true)}/>:route.page==='market'?<MarketPage lang={lang} open={open} request={route}/>:route.page==='wallet'?<WalletPage lang={lang} account={account} onSignIn={signIn}/>:route.page==='earnings'?<EarningsPage lang={lang} account={account} onSignIn={signIn}/>:route.page==='instances'?<InstancesPage lang={lang} account={account} onSignIn={signIn}/>:route.page==='machines'?<MachinesPage lang={lang} account={account} onSignIn={signIn}/>:route.page!=='home'?<BusinessPage key={route.page} kind={route.page} lang={lang} open={open}/>:<><div className={styles.firstScreen}><Background/><div className={styles.main}><Hero t={t} search={query=>open({type:'rent',query})}/></div></div><div className={styles.marketSection}><MarketBand t={t} lang={lang} marketRef={marketRef} open={open}/></div><HomeSections lang={lang} open={open}/></>}</main>{/* 资金 / 收益是控制台页，页脚只属于对外站（租用页同理：流程中不打断） */}
      {route.page!=='rent'&&route.page!=='wallet'&&route.page!=='earnings'&&route.page!=='instances'&&route.page!=='machines'&&<HomeFooter lang={lang} open={open}/>}<Dialog modal={modal} t={t} lang={lang} close={()=>setModal(null)}/><LoginDialog open={loginOpen} lang={lang} onClose={()=>setLoginOpen(false)} onSignIn={signIn}/></div>
}
