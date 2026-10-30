import { useEffect, useRef, useState } from 'react'
import type { Language } from './content'
import s from './EnterpriseJourney.module.css'

const copy = {
  zh: [
    {label:'采购',title:'全球资源，统一组织',body:'根据卡型、规模、预算与部署地区匹配算力资源。由 Mekong 统一沟通供给与采购安排，将分散在不同地区的资源组织成适合您的方案。',tags:['全球供给','多种配置','统一采购']},
    {label:'调试',title:'让资源适配您的工作环境',body:'围绕模型与业务需求，配置驱动、运行环境、网络和存储。完成软硬件联调，让各项资源协同工作，为业务运行做好准备。',tags:['环境配置','网络互联','软硬件联调']},
    {label:'验收',title:'逐项核对，确认交付条件',body:'按照约定检查资源配置、运行性能和网络连通性，核对交付清单与测试结果。在投入使用前，共同确认资源与环境满足项目要求。',tags:['配置核对','性能测试','交付清单']},
    {label:'交付',title:'统一开通，接入您的业务',body:'按约定时间开通算力资源，交付访问方式、配置说明与使用资料。协助团队完成接入，让跨地区、多种配置的资源统一进入业务工作流。',tags:['资源开通','访问交接','业务接入']},
    {label:'运维',title:'交付之后，服务持续',body:'连接全球运维团队，持续关注资源运行与业务使用情况。提供技术支持与故障响应，并根据业务变化安排续租、扩容和跨区域服务。',tags:['运行维护','故障响应','持续扩容']},
  ],
  en: [
    {label:'Procurement',title:'Global resources, coordinated supply',body:'Match GPU models, capacity, budgets, and deployment locations. Mekong coordinates suppliers and purchasing to bring resources across regions into a plan for your business.',tags:['Global supply','Multiple configurations','Unified procurement']},
    {label:'Configuration',title:'Resources prepared for your workload',body:'Configure drivers, runtime environments, networking, and storage around your models and business needs. Bring hardware and software together before your team begins work.',tags:['Runtime setup','Networking','System integration']},
    {label:'Acceptance',title:'Check each delivery requirement',body:'Review configurations, performance, and connectivity against the agreed requirements. Check the delivery inventory and test results together before resources enter service.',tags:['Configuration review','Performance testing','Delivery inventory']},
    {label:'Delivery',title:'One handover into your workflow',body:'Provision resources on the agreed schedule and hand over access details, configuration notes, and usage materials. Help your team connect resources across regions and configurations.',tags:['Provisioning','Access handover','Business onboarding']},
    {label:'Operations',title:'Support continues after delivery',body:'Connect with global operations teams for maintenance, technical support, and incident response. Coordinate renewals, expansion, and cross-region support as your business evolves.',tags:['Maintenance','Incident response','Capacity expansion']},
  ],
}

const scenes = [
  null,
  {file:'enterprise-delivery.webp',zh:'工程师在机房安装服务器',en:'Engineers installing a server in a data centre'},
  {file:'enterprise-acceptance.webp',zh:'负载测试的请求量、响应时间与检查结果',en:'Load testing dashboard with request rates, latency, and checks'},
  {file:'enterprise-configuration.webp',zh:'交换机端口与网络布线特写',en:'Network switch ports and cable connections'},
  {file:'enterprise-operations.webp',zh:'运维人员监测多屏运行状态',en:'Operations engineer monitoring service dashboards'},
]

// Keep route endpoints aligned with the map's 80N–60S equirectangular extent.
const mapLocations = {
  seoul:[126.98,37.57], sydney:[151.21,-33.87], melbourne:[144.96,-37.81],
  singapore:[103.82,1.35], jakarta:[106.85,-6.21], bangkok:[100.50,13.76],
  losAngeles:[-118.24,34.05], vancouver:[-123.12,49.28],
  beijing:[116.41,39.90], shanghai:[121.47,31.23],
  guangzhou:[113.26,23.13], shenzhen:[114.06,22.54],
} satisfies Record<string,number[]>
type MapLocation = keyof typeof mapLocations
// Spread regional connections across distinct arcs in the East Asia view.
const mapRoutes: {from:MapLocation;to:MapLocation;lift:number}[] = [
  {from:'losAngeles',to:'seoul',lift:30},
  {from:'vancouver',to:'shanghai',lift:25},
  {from:'seoul',to:'beijing',lift:6},
  {from:'seoul',to:'shanghai',lift:7},
  {from:'seoul',to:'singapore',lift:17},
  {from:'singapore',to:'shenzhen',lift:8},
  {from:'bangkok',to:'guangzhou',lift:9},
  {from:'jakarta',to:'singapore',lift:5},
  {from:'sydney',to:'seoul',lift:22},
  {from:'melbourne',to:'singapore',lift:15},
]
const mapPosition=(name:MapLocation)=>{
  const [lon,lat]=mapLocations[name]
  return [8+484*(lon+180)/360,28+223*(80-lat)/140]
}

function ResourceMap({lang,running}:{lang:Language;running:boolean}) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const elapsedRef=useRef(0)
  useEffect(()=>{
    const canvas=canvasRef.current
    const ctx=canvas?.getContext('2d')
    if(!canvas||!ctx)return
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame=0,last=0
    const point=(a:number[],b:number[],t:number,lift:number)=>{
      const x=(a[0]+b[0])/2,y=Math.min(a[1],b[1])-lift,u=1-t
      return [u*u*a[0]+2*u*t*x+t*t*b[0],u*u*a[1]+2*u*t*y+t*t*b[1]]
    }
    // Only continuous, softly tapered lines; no node or travelling head dots.
    const draw=()=>{
      ctx.clearRect(0,0,500,300)
      ctx.lineCap='round'
      mapRoutes.forEach(({from:a,to:b,lift},i)=>{
        const start=mapPosition(a),end=mapPosition(b)
        ctx.beginPath();ctx.moveTo(...start as [number,number])
        ctx.quadraticCurveTo((start[0]+end[0])/2,Math.min(start[1],end[1])-lift,end[0],end[1])
        ctx.strokeStyle='rgba(115,159,197,.32)';ctx.lineWidth=.45;ctx.stroke()
        if(preference.matches)return
        const time=elapsedRef.current
        // Overlapping streams keep the regional network active without synchronized flashes.
        const phase=(time+i*.69)%6.8
        if(phase>4.8)return
        const progress=phase/4.8
        const alpha=Math.min(1,progress/.15,(1-progress)/.18)*.75
        const length=.30
        for(let j=0;j<36;j++){
          const u=j/36,v=(j+1)/36
          const t=progress-length*(1-u),next=progress-length*(1-v)
          if(next<=0)continue
          const from=point(start,end,Math.max(0,t),lift),to=point(start,end,next,lift)
          const taper=Math.pow(Math.sin(v*Math.PI),1.5)
          // The halo and narrow core fade continuously into the curved route.
          ctx.beginPath();ctx.moveTo(from[0],from[1]);ctx.lineTo(to[0],to[1])
          ctx.strokeStyle=`rgba(100,180,231,${alpha*taper*.07})`;ctx.lineWidth=.8+taper*.6;ctx.stroke()
          ctx.strokeStyle=`rgba(204,242,255,${alpha*taper*.6})`;ctx.lineWidth=.25+taper*.35;ctx.stroke()
        }
      })
    }
    const resize=()=>{
      const ratio=Math.min(window.devicePixelRatio||1,2),width=canvas.getBoundingClientRect().width
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(width*.6*ratio))
      ctx.setTransform(canvas.width/500,0,0,canvas.height/300,0,0);draw()
    }
    const tick=(now:number)=>{
      if(last)elapsedRef.current+=(now-last)/1000
      last=now;draw();frame=requestAnimationFrame(tick)
    }
    const update=()=>{cancelAnimationFrame(frame);last=0;draw();if(running&&!preference.matches)frame=requestAnimationFrame(tick)}
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();update()
    preference.addEventListener('change',update)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();preference.removeEventListener('change',update)}
  },[running])
  return <div className={s.resourceMap} role="img" aria-label={lang==='zh'?'韩国、澳大利亚、东南亚及北美算力连接东南亚、韩国与中国一线城市':'Compute routes from Korea, Australia, Southeast Asia and North America to Southeast Asia, Korea and major Chinese cities'}>
    <div className={s.mapSurface}>
    <img src={`${import.meta.env.BASE_URL}assets/world-land.svg`} alt="" aria-hidden="true"/>
    <canvas ref={canvasRef} aria-hidden="true"/>
    </div>
  </div>
}

function JourneyVisual({stage,lang,running}:{stage:number;lang:Language;running:boolean}) {
  const scene=scenes[stage]
  if(scene)return <div className={s.scene} data-stage={stage===1?3:stage===3?1:stage}>
    <img src={`${import.meta.env.BASE_URL}assets/${scene.file}`} alt={scene[lang]} loading="lazy" width="1000" height="600"/>
    {stage===3&&<div className={s.portLights} aria-hidden="true"><i/><i/><i/></div>}
    {stage===2&&<div className={s.testFocus} aria-hidden="true"/>}
    {stage===1&&<div className={s.deliveryFocus} aria-hidden="true"/>}
    {stage===4&&<div className={s.operationsPulse} aria-hidden="true"/>}
  </div>
  return <ResourceMap lang={lang} running={running}/>
}

export default function EnterpriseJourney({lang}:{lang:Language}) {
  const [active,setActive]=useState(0)
  const [motion,setMotion]=useState(false)
  const [visible,setVisible]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const items=copy[lang]
  useEffect(()=>{
    const target=root.current
    if(!target)return
    let onScreen=false
    const update=()=>setVisible(onScreen&&!document.hidden)
    const observer=new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;update()},{threshold:.1})
    observer.observe(target)
    document.addEventListener('visibilitychange',update)
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',update)}
  },[])
  function select(index:number,animate:boolean) {setMotion(animate);setActive(index)}
  return <div ref={root} className={s.journey} data-motion={motion} data-visible={visible}>
    <div className={s.tabs} role="tablist" aria-label={lang==='zh'?'企业服务阶段':'Enterprise service stages'}>
      {items.map((item,index)=><button key={item.label} type="button" role="tab" id={`enterprise-stage-${index}`} aria-controls={`enterprise-stage-panel-${index}`} aria-selected={active===index} tabIndex={active===index?0:-1}
        onClick={event=>select(index,event.detail!==0)}
        onPointerEnter={event=>{if(event.pointerType==='mouse')select(index,true)}}
        onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
          event.preventDefault()
          const next=event.key==='Home'?0:event.key==='End'?4:(index+(event.key==='ArrowRight'?1:4))%5
          select(next,false)
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
        }}><span>{item.label}</span><i aria-hidden="true"/></button>)}
    </div>
    <div className={s.panels}>
      {items.map((item,index)=><div key={item.label} id={`enterprise-stage-panel-${index}`} role="tabpanel" aria-labelledby={`enterprise-stage-${index}`} aria-hidden={active!==index} inert={active!==index} className={s.panel} data-active={active===index}>
        <div className={s.artwork}><JourneyVisual stage={index} lang={lang} running={visible&&active===index}/></div>
        <div className={s.copy}><h3>{item.title}</h3><p>{item.body}</p><div className={s.tags}>{item.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div>
      </div>)}
    </div>
  </div>
}
