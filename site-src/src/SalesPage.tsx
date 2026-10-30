import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { Language } from './content'
import Icon from './Icons'
import styles from './SalesPage.module.css'

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const gpuOptions = ['RTX 5090', 'RTX PRO 6000', 'RTX 4090', 'H100', 'H200', 'B300', 'GB300', 'other']
const quantityOptions = ['1–8', '9–32', '33–128', '129–512', '513+', 'unsure']
const purposeOptions = ['training','inference','rendering','resale','second-brain','other']
const copy = {
  zh: {
    home: '首页', breadcrumb: '企业算力', title: '为您的业务匹配企业算力', intro: '从 GPU 型号、使用规模到部署地区，为您的团队规划算力资源与交付方案。', formTitle: '企业算力需求', formIntro: '请填写以下信息，帮助我们了解您的需求。', required: '* 为必填项', labels: ['算力用途','GPU 型号','GPU 数量','使用时间','使用国家 / 地区','企业名称','企业国家 / 地区','联系人','联系邮箱','具体需求'], purposePlaceholder:'请选择算力用途', purposes:['模型训练','模型推理','图像渲染','转租','第二大脑','其他'], companyPlaceholder:'请输入企业名称', countryPlaceholder:'请选择或搜索国家 / 地区', countrySearch:'可搜索中文、英文或地区代码', countryEmpty:'没有找到匹配的国家 / 地区', chooseCountry:'请从列表选择一个国家 / 地区', mainland:'中国大陆', gpuPlaceholder:'请选择卡型', quantityPlaceholder:'请选择需求数量', durationPlaceholder:'请选择预计租期', personPlaceholder:'请输入联系人姓名', emailPlaceholder:'name@company.com', detailsPlaceholder:'可以补充任务类型、模型与环境、预计开始时间、数据所在地、网络与存储、服务保障或其他要求。', optional:'选填', other:'其他', unsure:'尚未确定', cards:'张', durations:['1 天以内','1–7 天','1–4 周','1–3 个月','3–6 个月','6–12 个月','1 年以上','尚未确定'], submit:'查看需求', successTitle:'企业需求确认', successIntro:'以下为本次填写内容，可返回修改。', edit:'返回修改', back:'返回首页', noDetails:'未填写', showCountries:'展开国家 / 地区列表',
  },
  en: {
    home:'Home', breadcrumb:'Enterprise compute', title:'Enterprise compute tailored to your business', intro:'Share your GPU models, scale, locations, and duration. Work with our team to define resources and delivery.', formTitle:'Enterprise compute requirements',formIntro:'Please complete the information below to help us understand your requirements.',required:'* Required fields',labels:['Compute use case','GPU model','Number of GPUs','Usage duration','Deployment country / region','Company name','Company country / region','Contact name','Contact email','Specific requirements'],purposePlaceholder:'Choose a use case',purposes:['Model training','Model inference','Image rendering','Resale','Second Brain','Other'],companyPlaceholder:'Enter your company name',countryPlaceholder:'Select or search a country / region',countrySearch:'Search by English, Chinese, or region code',countryEmpty:'No matching country or region',chooseCountry:'Choose a country or region from the list',mainland:'Mainland China',gpuPlaceholder:'Choose a GPU model',quantityPlaceholder:'Choose a capacity range',durationPlaceholder:'Choose an expected duration',personPlaceholder:'Enter your contact name',emailPlaceholder:'name@company.com',detailsPlaceholder:'Tell us about your workload, models and environment, expected start date, data location, networking, storage, service requirements, or anything else we should know.',optional:'Optional',other:'Other',unsure:'Not sure yet',cards:'GPUs',durations:['Under 1 day','1–7 days','1–4 weeks','1–3 months','3–6 months','6–12 months','Over 1 year','Not sure yet'],submit:'Review requirements',successTitle:'Review your requirements.',successIntro:'Review your details below, or return to make changes.',edit:'Edit requirements',back:'Back to home',noDetails:'Not provided',showCountries:'Open country / region list',
  },
}

const enterpriseCopy = {
  zh: {
    title: '为什么选择 Mekong',
    intro: '从资源匹配到持续使用，把采购、交付和服务衔接起来。',
    advantages: [
      {title:'个性化需求',body:'根据您的模型、业务规模与部署地区，匹配 GPU、网络、存储和安全要求，让算力方案贴合实际任务。'},
      {title:'复杂算力，统一交付',body:'多个地区，多种配置。从采购、调试、验收到交付，Mekong Supercompute 为客户一次完成。'},
      {title:'全球运维，跨区域服务',body:'衔接全球运维团队，实时提供技术对接、运行维护与故障响应，为跨区域部署提供持续支持。'},
      {title:'合同灵活',body:'不同卡型、月租年租与不同账期可灵活组合，由 Mekong 统一纳入一份合同，采购、续租和结算一次安排。'},
    ],
    processTitle: '从需求到交付，逐步确认',
    process: [
      {title:'说明需求',body:'卡型、规模、地区、使用时间，以及模型、网络、存储和数据所在地要求。'},
      {title:'确认方案',body:'沟通资源组合、可用时段、价格、服务标准和验收条件。'},
      {title:'安排交付',body:'按约定容量协调开通，衔接运行支持、续期与扩容。'},
    ],
  },
  en: {
    title: 'Why choose Mekong',
    intro: 'Connect resource planning, procurement, delivery, and ongoing service.',
    advantages: [
      {title:'Tailored to your requirements',body:'Match GPUs, networking, storage, and security requirements to your models, business scale, and deployment locations.'},
      {title:'Complex compute, unified delivery',body:'Multiple regions, multiple configurations. Mekong Supercompute handles procurement, configuration, acceptance, and delivery in one coordinated process.'},
      {title:'Global operations, cross-region support',body:'Connect with global operations teams for real-time technical onboarding, maintenance, and incident response, with ongoing support across regions.'},
      {title:'Flexible contracts',body:'Combine GPU models, monthly and annual rentals, and different billing schedules under one Mekong contract, with procurement, renewals, and settlement arranged together.'},
    ],
    processTitle: 'From requirements to delivery',
    process: [
      {title:'Share requirements',body:'GPU models, scale, locations, dates, models, networking, storage, and data residency.'},
      {title:'Agree a plan',body:'Review resources, availability, pricing, service standards, and acceptance criteria.'},
      {title:'Coordinate delivery',body:'Arrange provisioning for agreed capacity, with ongoing support, renewals, and expansion.'},
    ],
  },
}

function countries(lang: Language) {
  const zh = new Intl.DisplayNames(['zh-Hans'], { type:'region' }), en = new Intl.DisplayNames(['en'], { type:'region' })
  return countryCodes.map(code => ({code,label:code==='CN'?copy[lang].mainland:(lang==='zh'?zh:en).of(code) || code,search:`${code} ${zh.of(code)} ${en.of(code)}`.toLocaleLowerCase()})).sort((a,b)=>a.label.localeCompare(b.label,lang==='zh'?'zh-Hans':'en'))
}

function CountrySelect({lang,value,change,inputId,name,label}:{lang:Language;value:string;change:(code:string)=>void;inputId:string;name:string;label:string}) {
  const t=copy[lang],id=useId(),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null)
  const [expanded,setExpanded]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[invalid,setInvalid]=useState(false)
  const options=useMemo(()=>countries(lang),[lang])
  const filtered=options.filter(item=>`${item.label} ${item.search}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected=options.find(item=>item.code===value)
  useEffect(()=>{input.current?.setCustomValidity(value?'':t.chooseCountry);if(value)setInvalid(false)},[value,t.chooseCountry])
  useEffect(()=>{if(expanded)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'})},[expanded,active,id])
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setExpanded(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
  const select=(code:string)=>{change(code);setQuery('');setExpanded(false);setInvalid(false)}
  function keyDown(event:KeyboardEvent<HTMLInputElement>) {
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!expanded){setExpanded(true);setQuery('');setActive(0)}else setActive(index=>Math.max(0,Math.min(filtered.length-1,index+(event.key==='ArrowDown'?1:-1))))}
    else if(event.key==='Enter'&&expanded){event.preventDefault();if(filtered[active])select(filtered[active].code)}
    else if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();setExpanded(false)}
    else if(event.key==='Tab')setExpanded(false)
  }
  return <div className={styles.countrySelect} ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setExpanded(false)}}>
    <div className={styles.countryControl}><input ref={input} id={inputId} name={`${name}Display`} role="combobox" autoComplete="off" required aria-expanded={expanded} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={expanded&&filtered[active]?`${id}-option-${active}`:undefined} aria-describedby={`${id}-help${invalid?` ${id}-error`:''}`} aria-invalid={invalid} value={expanded?query:selected?.label||''} placeholder={t.countryPlaceholder} onFocus={()=>{setExpanded(true);setQuery('');setActive(0)}} onClick={()=>setExpanded(true)} onChange={event=>{setQuery(event.target.value);change('');setActive(0);setExpanded(true)}} onKeyDown={keyDown} onInvalid={()=>setInvalid(true)}/><button type="button" tabIndex={-1} aria-label={`${t.showCountries} · ${label}`} onClick={()=>{if(expanded)setExpanded(false);else{input.current?.focus();setExpanded(true);setQuery('');setActive(0)}}}><Icon name="chevron" size={15}/></button></div>
    <input type="hidden" name={name} value={value}/><small id={`${id}-help`} className={styles.fieldHelp}>{t.countrySearch}</small>
    {invalid&&<small id={`${id}-error`} className={styles.fieldError}>{t.chooseCountry}</small>}
    {expanded&&<div className={styles.countryPopup}><div role="listbox" id={`${id}-list`} aria-label={label}>{filtered.length?filtered.map((item,index)=><button key={item.code} type="button" role="option" id={`${id}-option-${index}`} aria-selected={value===item.code} data-active={index===active} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>select(item.code)}><span>{item.label}</span><small>{item.code}</small>{value===item.code&&<Icon name="check" size={14}/>}</button>):<p>{t.countryEmpty}</p>}</div></div>}
  </div>
}

type MultiOption={value:string;label:string;search?:string}
function MultiSelect({lang,value,change,inputId,name,label,placeholder,options,searchHint}:{lang:Language;value:string[];change:(values:string[])=>void;inputId:string;name:string;label:string;placeholder:string;options:MultiOption[];searchHint?:string}) {
  const id=useId(),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null)
  const [expanded,setExpanded]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[invalid,setInvalid]=useState(false)
  const filtered=options.filter(option=>`${option.label} ${option.search||''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>Number(b.value.toLocaleLowerCase()===query.trim().toLocaleLowerCase())-Number(a.value.toLocaleLowerCase()===query.trim().toLocaleLowerCase()))
  const prompt=lang==='zh'?'请至少选择一项':'Select at least one option'
  useEffect(()=>{input.current?.setCustomValidity(value.length?'':prompt);if(value.length)setInvalid(false)},[value,prompt])
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setExpanded(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
  useEffect(()=>{if(expanded)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'})},[expanded,active,id])
  function toggle(option:string){change(value.includes(option)?value.filter(item=>item!==option):[...value,option])}
  return <div className={styles.multiSelect} ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setExpanded(false);setQuery('')}}}>
    <div className={styles.multiControl} data-invalid={invalid} data-has-value={value.length>0} data-query={Boolean(query)}>
      {value.length>0&&<div className={styles.selectedTags}>{value.map(item=><button key={item} type="button" aria-label={`${lang==='zh'?'移除':'Remove'} ${options.find(option=>option.value===item)?.label||item}`} onClick={()=>toggle(item)}>{options.find(option=>option.value===item)?.label||item}<Icon name="close" size={12}/></button>)}</div>}
      <div className={styles.multiInput}><input id={inputId} ref={input} role="combobox" autoComplete="off" required={!value.length} aria-required="true" aria-expanded={expanded} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={expanded&&filtered[active]?`${id}-option-${active}`:undefined} aria-invalid={invalid} aria-describedby={invalid?`${id}-error`:undefined} value={query} placeholder={value.length?'':placeholder} onFocus={()=>{setExpanded(true);setActive(0)}} onClick={()=>setExpanded(true)} onChange={event=>{setQuery(event.target.value);setActive(0);setExpanded(true)}} onInvalid={()=>setInvalid(true)} onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!expanded){setExpanded(true);setActive(0)}else setActive(index=>Math.max(0,Math.min(filtered.length-1,index+(event.key==='ArrowDown'?1:-1))))}
        else if(event.key==='Enter'){event.preventDefault();if(expanded&&filtered[active])toggle(filtered[active].value);else setExpanded(true)}
        else if(event.key==='Escape'){event.preventDefault();setExpanded(false);setQuery('')}
      }}/><button type="button" tabIndex={-1} aria-label={`${lang==='zh'?'展开选项':'Show options'} · ${label}`} onClick={()=>{if(expanded)setExpanded(false);else{input.current?.focus();setExpanded(true)}}}><Icon name="chevron" size={15}/></button></div>
    </div>
    {value.map(item=><input key={item} type="hidden" name={name} value={item}/>)}
    <small className={styles.fieldHelp}>{searchHint||(lang==='zh'?'可多选':'Select multiple options')}</small>
    {invalid&&<small id={`${id}-error`} className={styles.fieldError}>{prompt}</small>}
    {expanded&&<div className={`${styles.countryPopup} ${styles.multiPopup}`}><div role="listbox" id={`${id}-list`} aria-label={label} aria-multiselectable="true">{filtered.length?filtered.map((option,index)=><button key={option.value} type="button" role="option" id={`${id}-option-${index}`} aria-selected={value.includes(option.value)} data-active={active===index} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>toggle(option.value)}><span className={styles.optionCheck}>{value.includes(option.value)&&<Icon name="check" size={12}/>}</span><span>{option.label}</span></button>):<p>{lang==='zh'?'没有匹配的选项':'No matching options'}</p>}</div></div>}
  </div>
}

type Draft={purpose:string[];gpu:string[];quantity:string;duration:string;usageCountry:string[];company:string;companyCountry:string;contact:string;email:string;requirements:string}
const blankDraft:Draft={purpose:[],gpu:[],quantity:'',duration:'',usageCountry:[],company:'',companyCountry:'',contact:'',email:'',requirements:''}

function DeliverySteps({steps}:{steps:{title:string;body:string}[]}) {
 const root=useRef<HTMLOListElement>(null),[revealed,setRevealed]=useState(false)
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>{
   if(entries[0].isIntersecting){setRevealed(true);observer.disconnect()}
  },{threshold:.2})
  if(root.current)observer.observe(root.current)
  return()=>observer.disconnect()
 },[])
 return <ol ref={root} className={styles.deliverySteps} data-revealed={revealed}>{steps.map((item,index)=><li key={item.title}>
  <span className={styles.stepNumber} aria-hidden="true">{index+1}</span>
  <h3>{item.title}</h3><p>{item.body}</p>
 </li>)}</ol>
}

export default function SalesPage({lang}:{lang:Language}) {
  const t=copy[lang],enterprise=enterpriseCopy[lang],[draft,setDraft]=useState<Draft>(blankDraft),[complete,setComplete]=useState(false),title=useRef<HTMLHeadingElement>(null)
  const update=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(current=>({...current,[key]:value}))
  const gpuLabel=(value:string)=>value==='other'?t.other:value
  const quantityLabel=(value:string)=>value==='unsure'?t.unsure:`${value} ${t.cards}`
  const submit=(event:FormEvent)=>{event.preventDefault();setComplete(true);requestAnimationFrame(()=>title.current?.focus())}
  const countryLabel=(code:string)=>countries(lang).find(item=>item.code===code)?.label||''
  const summary=[draft.purpose.map(value=>t.purposes[purposeOptions.indexOf(value)]).join('、'),draft.gpu.map(gpuLabel).join('、'),quantityLabel(draft.quantity),t.durations[Number(draft.duration)],draft.usageCountry.map(countryLabel).join('、'),draft.company,countryLabel(draft.companyCountry),draft.contact,draft.email,draft.requirements||t.noDetails]
  return <div className={styles.salesPage}><div className={styles.container}><div className={styles.breadcrumb}><a href="#main">{t.home}</a><span>/</span><span>{t.breadcrumb}</span></div><header className={styles.introduction}><h1>{t.title}</h1><p>{t.intro}</p></header>
    <section className={styles.formPanel} id="sales-form" aria-labelledby="sales-form-title">{complete?<><span className={styles.successIcon}><Icon name="check" size={26}/></span><h2 id="sales-form-title" ref={title} tabIndex={-1}>{t.successTitle}</h2><p className={styles.formIntro}>{t.successIntro}</p><dl className={styles.review}>{summary.map((value,index)=><div key={index}><dt>{t.labels[index]}</dt><dd>{value}</dd></div>)}</dl><div className={styles.successActions}><button type="button" className={styles.submit} onClick={()=>setComplete(false)}>{t.edit}<Icon name="arrow" size={17}/></button><a href="#main">{t.back}</a></div></>:<><div className={styles.formHeading}><div><h2 id="sales-form-title">{t.formTitle}</h2><p className={styles.formIntro}>{t.formIntro}</p></div><small>{t.required}</small></div><form onSubmit={submit} className={styles.form}>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-purpose">{t.labels[0]} <b>*</b></label><MultiSelect lang={lang} inputId="sales-purpose" name="purpose" label={t.labels[0]} placeholder={t.purposePlaceholder} value={draft.purpose} change={values=>update('purpose',values)} options={purposeOptions.map((value,index)=>({value,label:t.purposes[index]}))}/></div>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-gpu">{t.labels[1]} <b>*</b></label><MultiSelect lang={lang} inputId="sales-gpu" name="gpu" label={t.labels[1]} placeholder={t.gpuPlaceholder} value={draft.gpu} change={values=>update('gpu',values)} options={gpuOptions.map(value=>({value,label:gpuLabel(value)}))}/></div>
      <div className={`${styles.field} ${styles.thirdWidth}`}><label htmlFor="sales-quantity">{t.labels[2]} <b>*</b></label><select id="sales-quantity" name="quantity" required value={draft.quantity} onChange={e=>update('quantity',e.target.value)}><option value="" disabled>{t.quantityPlaceholder}</option>{quantityOptions.map(quantity=><option key={quantity} value={quantity}>{quantityLabel(quantity)}</option>)}</select></div>
      <div className={`${styles.field} ${styles.thirdWidth}`}><label htmlFor="sales-duration">{t.labels[3]} <b>*</b></label><select id="sales-duration" name="duration" required value={draft.duration} onChange={e=>update('duration',e.target.value)}><option value="" disabled>{t.durationPlaceholder}</option>{t.durations.map((duration,i)=><option key={i} value={i}>{duration}</option>)}</select></div>
      <div className={`${styles.field} ${styles.thirdWidth}`}><label htmlFor="sales-usage-country">{t.labels[4]} <b>*</b></label><MultiSelect lang={lang} inputId="sales-usage-country" name="usageCountry" label={t.labels[4]} placeholder={t.countryPlaceholder} value={draft.usageCountry} change={values=>update('usageCountry',values)} options={countries(lang).map(item=>({value:item.code,label:item.label,search:item.search}))} searchHint={lang==='zh'?'可多选，可搜索中文、英文或地区代码':'Select multiple; search by name or region code'}/></div>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-company">{t.labels[5]} <b>*</b></label><input id="sales-company" name="company" autoComplete="organization" required maxLength={180} value={draft.company} onChange={e=>update('company',e.target.value)} placeholder={t.companyPlaceholder}/></div>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-company-country">{t.labels[6]} <b>*</b></label><CountrySelect lang={lang} inputId="sales-company-country" name="companyCountry" label={t.labels[6]} value={draft.companyCountry} change={code=>update('companyCountry',code)}/></div>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-contact">{t.labels[7]} <b>*</b></label><input id="sales-contact" name="contact" autoComplete="name" required maxLength={100} value={draft.contact} onChange={e=>update('contact',e.target.value)} placeholder={t.personPlaceholder}/></div>
      <div className={`${styles.field} ${styles.halfWidth}`}><label htmlFor="sales-email">{t.labels[8]} <b>*</b></label><input id="sales-email" name="email" type="email" autoComplete="email" required maxLength={254} value={draft.email} onChange={e=>update('email',e.target.value)} placeholder={t.emailPlaceholder}/></div>
      <div className={`${styles.field} ${styles.fullWidth}`}><label htmlFor="sales-requirements">{t.labels[9]}<small>{t.optional}</small></label><textarea id="sales-requirements" name="requirements" rows={5} maxLength={5000} value={draft.requirements} onChange={e=>update('requirements',e.target.value)} placeholder={t.detailsPlaceholder}/></div>
      <div className={`${styles.submitRow} ${styles.fullWidth}`}><button className={styles.submit} type="submit">{t.submit}<Icon name="arrow" size={17}/></button></div>
    </form></>}</section>
    <section className={styles.advantages} aria-labelledby="enterprise-advantages-title"><div className={styles.sectionHeading}><h2 id="enterprise-advantages-title">{enterprise.title}</h2><p>{enterprise.intro}</p></div><div className={styles.advantageGrid}>{enterprise.advantages.map(item=><article key={item.title}><div><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</div></section>
    <section className={styles.delivery} aria-label={lang==='zh'?'企业服务流程':'Enterprise service process'}><DeliverySteps steps={enterprise.process}/></section>
  </div></div>
}
