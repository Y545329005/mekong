import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { counts, history, listedGpus, marketData, regions } from './content'
import type { Gpu, Language, Region } from './content'
import { homeCopy } from './homeContent'
import type { ModalState } from './types'
import { priceDistributionHistory, supplyHistory } from './marketModel'
import Icon from './Icons'
import { AIWorkloads, DeveloperAccess } from './HomePlatformInfo'
import EnterpriseJourney from './EnterpriseJourney'
import styles from './HomeSections.module.css'

type Props = { lang: Language; open: (modal: ModalState) => void }
const money = (value: number) => `$${value.toFixed(2)}`

export function jumpTo(id: string) {
  const section = document.getElementById(id)
  if (!section) { window.location.hash = `#${id}`; return }
  section?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  section?.focus({ preventScroll: true })
}

function SectionHeading({ eyebrow, title, description, left = false }: { eyebrow: string; title: ReactNode; description?: ReactNode; left?: boolean }) {
  return <div className={`${styles.sectionHeading} ${left ? styles.leftHeading : ''}`}><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
}

function RoleText({active,values,animate}:{active:number;values:readonly string[];animate:boolean}) {
  return <span className={styles.roleText} data-motion={animate}>{values.map((value,index)=><span key={index} className={styles.roleTextLayer} aria-hidden={active!==index}>{value}</span>)}</span>
}

function HistoryChart({ gpu, period, lang, metric, region }: { gpu: Gpu; period: 1 | 7 | 30; lang: Language; metric: 'price'|'supply'; region: Region }) {
  const quantities = supplyHistory(gpu, period, region)
  const entries = history(gpu, period).map((entry, i) => ({...entry, price: metric === 'price' ? entry.price : quantities[i].available}))
  const [point, setPoint] = useState<number | null>(null)
  useEffect(() => setPoint(null), [gpu.id, period])
  const values = entries.map(entry => entry.price), low = metric === 'price' ? Math.min(...values) * .96 : 0, high = metric === 'price' ? Math.max(...values) * 1.04 : Math.max(1,...values,...quantities.map(item=>item.rented)) * 1.12
  const x = (i: number) => entries.length===1?384:58 + i * 652 / (entries.length - 1)
  const y = (value: number) => 186 - (value - low) / (high - low) * 155
  const path = entries.map((entry, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(entry.price)}`).join(' ')
  const index = point === null ? null : Math.min(point, entries.length - 1)
  const t = homeCopy[lang].market
  return <div className={styles.historyChart}>
    <svg viewBox="0 0 740 230" role="img" tabIndex={0} aria-label={`${gpu.name} ${metric === 'price' ? t.graphLabel : lang === 'zh' ? '可租与已租数量走势' : 'Available and rented GPU history'}`} onFocus={() => setPoint(entries.length - 1)} onBlur={() => setPoint(null)} onMouseLeave={() => setPoint(null)} onMouseMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const mouse = (event.clientX - rect.left) / rect.width * 740; setPoint(Math.max(0, Math.min(entries.length - 1, Math.round((mouse - 58) / 652 * (entries.length - 1))))) }} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPoint(current => Math.max(0, Math.min(entries.length - 1, (current ?? entries.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)))) } }}>
      <defs><linearGradient id={`price-fill-${gpu.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6592c9" stopOpacity=".19"/><stop offset="1" stopColor="#6592c9" stopOpacity="0"/></linearGradient></defs>
      {Array.from({ length: 4 }, (_, i) => { const value = high - i * (high - low) / 3; return <g key={i}><line x1="58" x2="710" y1={y(value)} y2={y(value)} stroke="#6e97a7" strokeOpacity=".14" strokeDasharray="3 5"/><text x="42" y={y(value) + 4} textAnchor="end" fill="#72909f" fontSize="11">{metric === 'price' ? money(value) : Math.round(value)}</text></g> })}
      {entries.length>1&&<path d={`${path} L710,194 L58,194 Z`} fill={`url(#price-fill-${gpu.id})`}/>}<path d={path} fill="none" stroke="#83a8d0" strokeWidth="2.3" strokeLinejoin="round"/>
      {metric === 'supply' && <path d={quantities.map((entry,i)=>`${i===0?'M':'L'}${x(i)},${y(entry.rented)}`).join(' ')} fill="none" stroke="#4d8ed2" strokeWidth="2" strokeLinejoin="round"/>}
      {index !== null && <g><line x1={x(index)} x2={x(index)} y1="24" y2="194" stroke="#afc9e8" strokeOpacity=".35" strokeDasharray="3 4"/><circle cx={x(index)} cy={y(entries[index].price)} r="4" fill="#afc9e8" stroke="#09171e" strokeWidth="2"/></g>}
      <text x="58" y="221" fill="#72909f" fontSize="11">{entries[0].date.slice(5)}</text><text x="710" y="221" textAnchor="end" fill="#72909f" fontSize="11">{entries[entries.length - 1].date.slice(5)}</text>
      {entries.length===1&&<circle cx={x(0)} cy={y(entries[0].price)} r="4" fill="#83a8d0"/>}
    </svg>
    {index !== null && <div className={styles.chartReadout} role="status">{entries[index].date}<strong>{metric === 'price' ? money(entries[index].price) : `${t.available} ${quantities[index].available} · ${t.rented} ${quantities[index].rented} · ${t.total} ${quantities[index].total}`}</strong></div>}
  </div>
}

function PriceCandleChart({gpu,period,lang,region}:{gpu:Gpu;period:1|7|30;lang:Language;region:Region}) {
  const rows=priceDistributionHistory(gpu,period,region)
  const [active,setActive]=useState<number|null>(null)
  useEffect(()=>setActive(null),[gpu.id,period,region])
  const floor=Math.min(...rows.map(row=>row.min)),ceiling=Math.max(...rows.map(row=>row.max))
  const padding=Math.max((ceiling-floor)*.16,ceiling*.025,.005)
  const low=Math.max(0,floor-padding),high=ceiling+padding
  const x=(index:number)=>92+(index+.5)*840/rows.length
  const y=(price:number)=>282-(price-low)/(high-low)*240
  const boxWidth=Math.min(42,840/rows.length*.48)
  const index=active===null?null:Math.min(active,rows.length-1)
  const selected=index===null?null:rows[index]
  const zh=lang==='zh'
  return <div className={styles.boxChart}>
    <svg viewBox="0 0 1000 335" role="group" aria-label={`${gpu.name} ${zh?'每日价格 K 线图':'Daily price candlestick chart'}`}>
      {Array.from({length:5},(_,i)=>{const value=low+(high-low)*i/4;return <g key={i}><line x1="80" x2="952" y1={y(value)} y2={y(value)} className={styles.boxGrid}/><text x="65" y={y(value)+4} textAnchor="end" className={styles.boxAxis}>{money(value)}</text></g>})}
      {rows.map((row,i)=><g key={row.date} role="img" tabIndex={0} aria-label={`${row.date} ${zh?'开盘':'Open'} ${money(row.open)}, ${zh?'最高':'High'} ${money(row.max)}, ${zh?'最低':'Low'} ${money(row.min)}, ${zh?'收盘':'Close'} ${money(row.close)}`} className={styles.priceBox} data-active={index===i} data-direction={row.close>=row.open?'up':'down'} data-language={lang} onMouseEnter={()=>setActive(i)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(i)} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const next=Math.max(0,Math.min(rows.length-1,i+(event.key==='ArrowRight'?1:-1)));event.currentTarget.parentElement?.querySelectorAll<SVGGElement>('[tabindex="0"]')[next]?.focus()}}>
        <rect x={x(i)-840/rows.length/2} y="32" width={840/rows.length} height="260" fill="transparent"/>
        <line x1={x(i)} x2={x(i)} y1={y(row.max)} y2={y(row.min)} className={styles.boxWhisker}/>
        
        <rect x={x(i)-boxWidth/2} y={y(Math.max(row.open,row.close))} width={boxWidth} height={Math.max(1.5,Math.abs(y(row.open)-y(row.close)))} rx="2" className={styles.boxBody}/>
        
        {(period===7||i%5===0||i===rows.length-1)&&<text x={x(i)} y="311" textAnchor="middle" className={styles.boxAxis}>{row.date.slice(5)}</text>}
      </g>)}
    </svg>
    {selected&&<div className={styles.boxReadout} role="status"><strong>{selected.date}</strong>{(zh?['开盘','最高','最低','收盘']:['Open','High','Low','Close']).map((label,i)=><span key={label}>{label}<b>{money([selected.open,selected.max,selected.min,selected.close][i])}</b></span>)}</div>}
  </div>
}

function QuoteCandles({gpu,region,lang}:{gpu:Gpu;region:Region;lang:Language}) {
  const rows=priceDistributionHistory(gpu,7,region)
  const min=Math.min(...rows.map(row=>row.min)),max=Math.max(...rows.map(row=>row.max))
  const spread=Math.max(max-min,max*.06,.005)
  const x=(index:number)=>22+index*256/(rows.length-1)
  const y=(value:number)=>111-(value-min)/spread*101
  return <svg className={styles.quoteCandles} viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label={`${gpu.name} ${lang==='zh'?'7天价格K线':'7-day price candlesticks'}`}>
    {rows.map((row,index)=><g key={row.date} className={`${styles.priceBox} ${styles.quoteCandle}`} data-language={lang} data-direction={row.close>=row.open?'up':'down'}>
      <line x1={x(index)} x2={x(index)} y1={y(row.max)} y2={y(row.min)} className={styles.boxWhisker} vectorEffect="non-scaling-stroke"/>
      <rect x={x(index)-7} y={y(Math.max(row.open,row.close))} width="14" height={Math.max(2,Math.abs(y(row.open)-y(row.close)))} rx="1" className={styles.boxBody}/>
    </g>)}
  </svg>
}

export function MarketShowcase({ lang, region, setRegion, initialMetric = 'price', search='', model='all', models, afterHistory, quoteHeader }: Props & { region: Region; setRegion: (value: Region) => void; initialMetric?: 'price'|'supply'; search?:string; model?:string; models?:readonly string[]; afterHistory?:ReactNode; quoteHeader?:ReactNode }) {
  const t = homeCopy[lang].market
  const [selected, setSelected] = useState('h100'), [period, setPeriod] = useState<1 | 7 | 30>(7), [metric, setMetric] = useState<'price'|'supply'>(initialMetric)
  useEffect(()=>setMetric(initialMetric),[initialMetric])
  useEffect(()=>{if(models?.length)setSelected(current=>models.includes(current)?current:models[0]);else if(model!=='all')setSelected(model)},[model,models])
  const shown=listedGpus.filter(item=>(models===undefined||models.includes(item.id))&&(model==='all'||item.id===model)&&`${item.name} ${item.memory}`.toLowerCase().includes(search.trim().toLowerCase()))
  const gpu = marketData.find(item => item.id === selected)!, supply = counts(gpu, region)
  return <section className={`${styles.section} ${styles.marketSection}`} id="resources" tabIndex={-1} aria-label={t.title}><div className={styles.container}>
    <div className={styles.priceHistorySection} id="price-history" tabIndex={-1}>
      <header className={styles.priceHistoryHeader}><div><h3>{lang==='zh'?(metric==='price'?'价格历史':'供需历史'):(metric==='price'?'Price history':'Supply history')}</h3><p>{lang==='zh'?(metric==='price'?'美元 / 卡 / 小时':'查看所选型号与地区的可租及已租数量。'):(metric==='price'?'USD per GPU-hour':'Available and rented capacity for the selected model and region.')}</p></div><div className={styles.historyPeriod} role="group" aria-label={t.days}>{([1,7,30] as const).map(days=><button key={days} aria-pressed={period===days} onClick={()=>setPeriod(days)}>{`${days}${lang==='zh'?' 天':days===1?' day':' days'}`}</button>)}</div></header>
      <div className={styles.historyFilters}><label><span>{lang==='zh'?'GPU 型号':'GPU model'}</span><select value={selected} onChange={event=>setSelected(event.target.value)}>{listedGpus.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>{lang==='zh'?'国家 / 地区':'Country / region'}</span><select value={region} onChange={event=>setRegion(event.target.value as Region)}>{regions.map(item=><option key={item.id} value={item.id}>{item[lang]}</option>)}</select></label><div className={styles.historyMetric} role="group" aria-label={lang==='zh'?'走势指标':'History metric'}><button aria-pressed={metric==='price'} onClick={()=>setMetric('price')}>{lang==='zh'?'挂牌价格':'Listing price'}</button><button aria-pressed={metric==='supply'} onClick={()=>setMetric('supply')}>{lang==='zh'?'供需数量':'Supply & demand'}</button></div></div>
      <div className={styles.historyFrame}><div className={styles.historyLegend}><strong><i/>{gpu.name}</strong><span>{regions.find(item=>item.id===region)![lang]}</span>{metric==='supply'&&<small>{t.available} {supply.available} · {t.rented} {supply.rented} · {t.total} {supply.total}</small>}</div>{supply.total?(metric==='price'?<PriceCandleChart gpu={gpu} period={period} lang={lang} region={region}/>:<HistoryChart gpu={gpu} period={period} lang={lang} metric={metric} region={region}/>):<p className={styles.historyEmpty}>{lang==='zh'?'该地区暂无该型号资源':'This model is not available in this region'}</p>}</div>
    </div>
    {afterHistory}
    <div className={styles.quoteCatalog} id="gpu-quotes" tabIndex={-1}>    {quoteHeader??<SectionHeading eyebrow={t.eyebrow} title={lang==='zh'?'所有实时价格':'All live prices'}/>}
    <div className={styles.gpuGrid}>{shown.map(item=>{
      const availability=counts(item,region)
      const countries=regions.filter(place=>place.id!=='all'&&(region==='all'||place.id===region)&&counts(item,place.id).total>0)
      const dates=history(item,7)
      // 当前价取序列末日（实时价，随行情跳动）；「较7天前」锚定 7 天前的滚动序列点。
      const current=dates[dates.length-1].price,change=current-dates[0].price,percent=change/dates[0].price*100
      const sign=change>=0?'+':'−'
      const dateLabel=(date:string)=>new Intl.DateTimeFormat(lang==='zh'?'zh-CN':'en-GB',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`))
      return <article className={styles.gpuCard} key={item.id}>
        <div className={styles.quoteHeading}><h3>{item.name}</h3><button className={styles.quoteHistoryLink} onClick={()=>{setSelected(item.id);setMetric('price');jumpTo('price-history')}} aria-label={`${lang==='zh'?'查看价格历史':'View price history'} · ${item.name}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 14l6-6 4 3 8-7M3 21h18M5 17v4m6-7v7m6-10v10"/></svg></button></div>
        <div className={styles.quoteCountries}>{countries.length?countries.map(place=><span key={place.id}><span aria-hidden="true">{{sg:'🇸🇬',jp:'🇯🇵',kr:'🇰🇷',us:'🇺🇸',all:''}[place.id]}</span>{place[lang]}</span>):<span>{lang==='zh'?'暂无地区':'No locations'}</span>}</div>
        <div className={styles.quoteValue}><div><strong>{availability.total?money(current):'—'}</strong><small>{availability.total?(availability.available?(lang==='zh'?'美元 / 卡 / 小时':'USD / GPU-hour'):(lang==='zh'?'参考价 · 已租满':'Reference · rented out')):(lang==='zh'?'暂无资源':'Unavailable')}</small></div>{availability.available>0&&<div className={styles.quoteChange}><b>{sign}${Math.abs(change).toFixed(2)} ({sign}{Math.abs(percent).toFixed(1)}%)</b><span>{lang==='zh'?'较7天前':'vs 7 days ago'}</span></div>}</div>
        {availability.total?<><QuoteCandles gpu={item} region={region} lang={lang}/><div className={styles.quoteDates}><span>{dateLabel(dates[0].date)}</span><span>{dateLabel(dates[dates.length-1].date)}</span></div></>:<div className={styles.quoteUnavailable}>{lang==='zh'?'该地区暂无该型号资源':'This model is not available in this region'}</div>}
      </article>
    })}</div>
{shown.length===0&&<p className={styles.historyEmpty}>{lang==='zh'?'没有匹配的 GPU 型号':'No matching GPU models'}</p>}</div>
  </div></section>
}

export function HomeSections({ lang, open }: Props) {
  const t = homeCopy[lang]
  const browse = () => open({ type: 'rent' })
  const [stepRole,setStepRole]=useState(0)
  const [roleMotion,setRoleMotion]=useState(false)
  const provider=stepRole===1
  const stepLabels=lang==='zh'?['租户','出租方']:['Renter','Provider']
  const providerCopy=lang==='zh'?{
    eyebrow:'',title:'从注册到上架，三步完成',description:'接入 GPU 设备，自行设定报价、管理订单并获得收益',cta:'上传 GPU',
    items:[{title:'注册并认证',body:'创建账号并完成身份认证，设置收款与结算信息。'},{title:'上传设备',body:'提交 GPU、处理器、存储与网络配置，完成设备接入与资源验证。'},{title:'发布报价',body:'设置价格和可用时段，上架设备并管理订单与收益。'}],
  }:{
    eyebrow:'',title:'From your GPUs to the marketplace',description:'Connect your machines, publish offers, and manage orders and earnings',cta:'Upload GPUs',
    items:[{title:'Register and verify',body:'Create an account, verify your identity, and set up payment and settlement information.'},{title:'Upload machines',body:'Submit GPU, CPU, storage, and network specifications, then complete connection and resource verification.'},{title:'Publish offers',body:'Set prices and availability, list your machines, and manage orders and earnings.'}],
  }
  const stepCopies=[t.steps,providerCopy]
  const stepCopy=stepCopies[stepRole]
  const uploadGpu=()=>open({type:'guide',title:lang==='zh'?'上传 GPU':'Upload GPUs',description:lang==='zh'?'提交设备配置，完成接入与验证后发布报价。':'Submit machine specifications, complete connection and verification, then publish your offers.',points:stepCopy.items.map(item=>item.body)})
  const stepColors=provider?['#173f39','#285c51','#398574','#58b59c','#a1efd4','#6fcbb2','#58b59c']:['#203b68','#274b7c','#315b92','#416fa7','#6b96cb','#4a76ad','#416fa7']
  const stepsContainerRef=useRef<HTMLDivElement>(null)
  const stepsRef=useRef<HTMLDivElement>(null)
  const stepsSvgRef=useRef<SVGSVGElement>(null)
  const [stepsActive,setStepsActive]=useState(false)
  const [stepsWidth,setStepsWidth]=useState(1000)
  const centers=[stepsWidth/6,stepsWidth/2,stepsWidth*5/6]
  const radius=21.5
  const circuit=centers.map(center=>`M ${center-radius} 22 A ${radius} ${radius} 0 1 1 ${center+radius} 22 A ${radius} ${radius} 0 1 1 ${center-radius} 22`).join(' ')+` M ${centers[0]+radius} 22 L ${centers[1]-radius} 22 M ${centers[1]+radius} 22 L ${centers[2]-radius} 22`
  useEffect(()=>{
    const container=stepsContainerRef.current
    const section=container?.parentElement
    if(!container||!section)return
    const measure=()=>section.style.setProperty('--steps-content-height',`${container.getBoundingClientRect().height}px`)
    const observer=new ResizeObserver(measure)
    observer.observe(container)
    measure()
    return()=>observer.disconnect()
  },[])
  useEffect(()=>{
    const svg=stepsSvgRef.current
    if(!svg)return
    if(stepsActive)svg.unpauseAnimations()
    else svg.pauseAnimations()
  },[stepsActive])
  useEffect(()=>{
    const target=stepsRef.current
    if(!target)return
    let visible=false
    const motion=matchMedia('(prefers-reduced-motion: reduce)')
    const update=()=>setStepsActive(visible&&!document.hidden&&!motion.matches)
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update()},{threshold:.1})
    observer.observe(target)
    const measure=()=>setStepsWidth(target.getBoundingClientRect().width)
    measure()
    const resizeObserver=new ResizeObserver(measure)
    resizeObserver.observe(target)
    document.addEventListener('visibilitychange',update)
    motion.addEventListener('change',update)
    return ()=>{observer.disconnect();resizeObserver.disconnect();document.removeEventListener('visibilitychange',update);motion.removeEventListener('change',update)}
  },[])
  return <div className={styles.homeContent}>
    <section className={`${styles.section} ${styles.stepsSection}`} id="how-it-works" tabIndex={-1}><div className={styles.container} ref={stepsContainerRef}><SectionHeading eyebrow={stepCopy.eyebrow} title={<RoleText active={stepRole} values={stepCopies.map(copy=>copy.title)} animate={roleMotion}/>} description={<RoleText active={stepRole} values={stepCopies.map(copy=>copy.description)} animate={roleMotion}/>}/><div className={styles.stepRoleSwitch} role="tablist" aria-label={lang==='zh'?'选择账号角色':'Choose an account role'}>{stepLabels.map((label,index)=><button key={label} type="button" role="tab" id={`step-role-${index}`} aria-selected={stepRole===index} aria-controls="steps-role-panel" tabIndex={stepRole===index?0:-1} onClick={event=>{setRoleMotion(event.detail!==0);setStepRole(index)}} onPointerEnter={event=>{if(event.pointerType==='mouse'){setRoleMotion(true);setStepRole(index)}}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;setRoleMotion(false);setStepRole(next);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()}}>{label}</button>)}</div><div id="steps-role-panel" role="tabpanel" aria-labelledby={`step-role-${stepRole}`}><div className={styles.stepsGrid} ref={stepsRef} data-animate={stepsActive} data-provider={provider}><svg ref={stepsSvgRef} className={styles.stepCircuit} viewBox={`0 0 ${stepsWidth} 44`} aria-hidden="true"><defs>{[0,1].map(stream=>(<linearGradient key={stream} id={`steps-liquid-light-${stream}`} gradientUnits="userSpaceOnUse" x1="-110" y1="0" x2="0" y2="0"><stop offset="0" stopColor={stepColors[0]} stopOpacity="0"/><stop offset=".25" stopColor={stepColors[1]} stopOpacity=".04"/><stop offset=".55" stopColor={stepColors[2]} stopOpacity=".24"/><stop offset=".78" stopColor={stepColors[3]} stopOpacity=".62"/><stop offset=".9" stopColor={stepColors[4]} stopOpacity=".95"/><stop offset=".97" stopColor={stepColors[5]} stopOpacity=".35"/><stop offset="1" stopColor={stepColors[6]} stopOpacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values={`${centers[0]-radius-20} 0;${centers[2]+radius+130} 0;${centers[2]+radius+130} 0`} keyTimes="0;0.625;1" dur="10.4s" begin={stream===0?'0s':'-5.2s'} repeatCount="indefinite"/></linearGradient>))}<filter id="steps-liquid-halo" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><path d={circuit} className={styles.circuitBase}/>{[0,1].map(stream=><g key={stream}><path d={circuit} className={styles.circuitGlow} stroke={`url(#steps-liquid-light-${stream})`} filter="url(#steps-liquid-halo)"/><path d={circuit} className={styles.circuitLight} stroke={`url(#steps-liquid-light-${stream})`}/></g>)}</svg>{stepCopy.items.map((_, i) => <article key={i}><span className={styles.stepNumber}>{i + 1}</span><h3><RoleText active={stepRole} values={stepCopies.map(copy=>copy.items[i].title)} animate={roleMotion}/></h3><p><RoleText active={stepRole} values={stepCopies.map(copy=>copy.items[i].body)} animate={roleMotion}/></p></article>)}</div><div className={styles.center}><button className={styles.primaryButton} onClick={provider?uploadGpu:browse}><RoleText active={stepRole} values={stepCopies.map(copy=>copy.cta)} animate={roleMotion}/><Icon name="arrow" size={17}/></button></div></div></div></section>
    <section className={`${styles.section} ${styles.rentalSection}`} id="rental-options" tabIndex={-1}><div className={styles.container}><SectionHeading eyebrow={t.rental.eyebrow} title={t.rental.title} description={t.rental.description}/><div className={styles.rentalGrid}>{t.rental.items.map(item => <article key={item.title}><span className={styles.rentalEnglish}>{item.english}</span><h3>{item.title}</h3><p>{item.body}</p><ul>{item.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>{item.cta&&<button className={styles.textButton} onClick={browse}><span>{item.cta}</span><Icon name="arrow" size={17}/></button>}</article>)}</div></div></section>

    <AIWorkloads lang={lang} open={open}/>
    <DeveloperAccess lang={lang}/>
    <section className={styles.partnerSection} id="enterprise" tabIndex={-1}>
      <div className={`${styles.container} ${styles.enterpriseLayout}`}>
        <div className={styles.enterpriseIntro}>
          <h2>{t.enterprise.title}</h2><p>{t.enterprise.description}</p>
        </div>
        <EnterpriseJourney lang={lang}/>
        <button className={styles.primaryButton} onClick={()=>open({type:'inquiry'})}>{t.enterprise.cta}<Icon name="arrow" size={17}/></button>
      </div>
    </section>
    <section className={`${styles.section} ${styles.faqSection}`} id="faq" tabIndex={-1}><div className={styles.narrowContainer}><SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title}/><div className={styles.faqList}>{t.faq.items.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary>{item.a.split('\n\n').map((paragraph,index)=><p key={index}>{paragraph}</p>)}</details>)}</div></div></section>
    <section className={styles.closingSection}><div className={styles.container}><h2>{t.closing.title}</h2><div className={styles.closingActions}><button className={styles.primaryButton} onClick={browse}>{t.closing.browse}<Icon name="arrow" size={18}/></button><button className={styles.primaryButton} onClick={() => open({ type: 'inquiry' })}>{t.closing.contact}<Icon name="arrow" size={18}/></button></div></div></section>
  </div>
}

export function HomeFooter({ lang, open }: Props) {
  const t = homeCopy[lang].footer
  function action(group: number, item: number) {
    if(group===0){
      if(item===0)open({type:'rent'})
      else if(item===1)open({type:'market',query:'',tab:'prices'})
      else if(item===2)jumpTo('rental-options')
      else open({type:'inquiry'})
    }else jumpTo(item===0?'ai-workloads':'faq')
  }
  return <footer className={styles.footer}><div className={styles.container}><div className={styles.footerMain}><div className={styles.footerBrand}><a href="#main" aria-label="Mekong Supercompute"><img src={`${import.meta.env.BASE_URL}assets/mekong-supercompute-white.svg`} width="168" height="60" alt="Mekong Supercompute"/></a></div>{t.groups.map((group, i) => <nav key={group.title} aria-label={group.title}><h3>{group.title}</h3>{group.links.map((link, j) => <button key={link} onClick={() => action(i,j)}>{link}</button>)}</nav>)}</div><div className={styles.footerBottom}><span>{t.copyright}</span><div><button onClick={() => open({ type: 'guide', title: t.privacy, description: t.privacyText, points: t.privacyPoints })}>{t.privacy}</button><button onClick={() => open({ type: 'guide', title: t.terms, description: t.termsText, points: t.termsPoints })}>{t.terms}</button><button onClick={() => jumpTo('main')}>{t.top}<Icon name="diagonal" size={13}/></button></div></div></div></footer>
}
