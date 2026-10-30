import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from './content'
import type { ModalState } from './types'
import Icon from './Icons'
import layout from './HomeSections.module.css'
import styles from './HomePlatformInfo.module.css'

type Props = { lang: Language; open: (modal: ModalState) => void }
function TerminalPlayback({lang}:{lang:Language}) {
  const zh=lang==='zh'
  const terminalRef=useRef<HTMLDivElement>(null)
  const [inView,setInView]=useState(false)
  const [visible,setVisible]=useState(()=>!document.hidden)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [progress,setProgress]=useState({row:0,chars:0})
  const lines=useMemo(()=>[
    {command:true,text:'$ mekong search --gpu rtx5070 --max-price 0.15'},
    {command:false,text:'id 31230659  1× RTX 5070  11.9GB  $0.104/hr  Texas, US'},
    {command:true,text:'$ mekong deploy --template vllm --id 31230659'},
    {command:false,text:'creating → loading → connecting → running (12s)'},
    {command:false,text:'endpoint https://gw.mekong.dev/v31230659/v1  ·  $0.0000289/s'},
    {command:true,text:'$ mekong instances list'},
    {command:false,text:'31230659  vllm  running  00:04:31  $0.0078'},
  ],[])
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:.1})
    if(terminalRef.current)observer.observe(terminalRef.current)
    const onVisibility=()=>setVisible(!document.hidden)
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)')
    const onPreference=()=>setReduced(preference.matches)
    document.addEventListener('visibilitychange',onVisibility)
    preference.addEventListener('change',onPreference)
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);preference.removeEventListener('change',onPreference)}
  },[])
  useEffect(()=>{
    if(!inView||!visible||reduced)return
    const current=lines[progress.row]
    const complete=!current
    const typing=current?.command&&progress.chars<current.text.length
    const delay=complete?4500:typing?12:current.command?220:180
    const timer=window.setTimeout(()=>setProgress(previous=>{
      if(complete)return {row:0,chars:0}
      if(typing)return {...previous,chars:previous.chars+1}
      return {row:previous.row+1,chars:0}
    }),delay)
    return ()=>window.clearTimeout(timer)
  },[progress,inView,visible,reduced,lines])
  const row=reduced?lines.length:progress.row
  return <div ref={terminalRef} className={styles.terminal} aria-label={zh?'命令行使用示例':'Example command-line workflow'}>
    <div className={styles.terminalBar}><span aria-hidden="true"><i/><i/><i/></span><span>deploy.py</span></div>
    <pre className={styles.terminalTranscript}>{lines.map(line=>line.text).join('\n')}</pre>
    <pre className={styles.animatedTranscript} aria-hidden="true"><code>{lines.slice(0,row).map((line,index)=><span key={index} className={line.command?styles.command:undefined}>{line.command?<><span className={styles.terminalPrompt}>$</span>{line.text.slice(1)}</>:line.text}{'\n'}</span>)}{row<lines.length&&<span className={lines[row].command?styles.command:undefined}>{lines[row].command?<><span className={styles.terminalPrompt}>{progress.chars>0?'$':''}</span>{lines[row].text.slice(1,Math.max(1,progress.chars))}</>:lines[row].text}</span>}<span className={styles.terminalCursor}>▌</span></code></pre>
  </div>
}

export function DeveloperAccess({lang}:Pick<Props,'lang'>) {
  const zh=lang==='zh'
  const title=zh?'一行命令，接入算力':'One command. Connected compute.'
  return <section className={`${layout.section} ${styles.developerSection}`} id="developer-access" tabIndex={-1} aria-labelledby="developer-title"><div className={`${layout.container} ${styles.developerGrid}`}>
    <div><h2 id="developer-title">{title}</h2><p>{zh?'与租用同一套 API：按秒计费、随取随停，训练推理通用。':'Use the same rental interface for training and inference, with per-second billing and control over when you run.'}</p><p className={styles.developerTools}>CLI · Python SDK · REST API</p></div>
    <TerminalPlayback lang={lang}/>
  </div></section>
}

export function AIWorkloads({lang,open}:Props) {
  const zh=lang==='zh'
  const [selected,setSelected]=useState(0)
  const carouselRef=useRef<HTMLDivElement>(null)
  const [hovered,setHovered]=useState(false)
  const [focused,setFocused]=useState(false)
  const [canRotate,setCanRotate]=useState(false)
  const [keyboardChange,setKeyboardChange]=useState(false)
  useEffect(()=>{
    let intersecting=false
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)')
    const update=()=>setCanRotate(intersecting&&!document.hidden&&!preference.matches)
    const observer=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;update()},{threshold:.25})
    if(carouselRef.current)observer.observe(carouselRef.current)
    document.addEventListener('visibilitychange',update)
    preference.addEventListener('change',update)
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);preference.removeEventListener('change',update)}
  },[])
  useEffect(()=>{
    if(!canRotate||hovered||focused)return
    const timer=window.setTimeout(()=>{setKeyboardChange(false);setSelected(value=>(value+1)%3)},6000)
    return ()=>window.clearTimeout(timer)
  },[selected,canRotate,hovered,focused])
  const applications=zh?[
    {title:'推理服务',summary:'部署模型，处理接口请求',body:'在 GPU 上运行开源模型，用于对话、内容处理与业务接口。可自行配置推理环境，也可由我们协助部署模型与访问接口。',image:'app-inference-models-v2.png',alt:'DeepSeek、Qwen、Llama、Mistral、Gemma与GLM彩色模型标识组成的抽象立体画面',caption:'',source:'',tools:['开源模型','推理环境','接口访问'],gpu:'H100'},
    {title:'模型训练',summary:'训练与微调，查看运行指标',body:'为训练与微调选择合适的显存、互联和存储配置。通过熟悉的开发环境运行任务，查看损失曲线与训练记录。',image:'app-training-learning-v3.png',alt:'多组彩色图像碎片从杂乱重组到稳定排列的学习过程意象',caption:'',source:'',tools:['PyTorch','JupyterLab','TensorBoard'],gpu:'H200'},
    {title:'图像生成',summary:'使用工作流，完成图像创作',body:'使用 ComfyUI 组织模型、提示词和生成节点，按工作流开展图像创作与批量任务。可自行使用，也可由我们协助配置环境。',image:'app-diffusion.jpg',alt:'Stable Diffusion 图像生成作品合集',caption:'',source:'',tools:['ComfyUI','模型与节点','生成工作流'],gpu:'RTX 5090'},
  ]:[
    {title:'Inference',summary:'Deploy models and serve requests',body:'Run open-source models for chat, content processing, and business APIs. Configure your own environment or ask us to help deploy models and access endpoints.',image:'app-inference-models-v2.png',alt:'An abstract sculptural grouping of colorful DeepSeek, Qwen, Llama, Mistral, Gemma and GLM model emblems',caption:'',source:'',tools:['Open-source models','Inference environment','API access'],gpu:'H100'},
    {title:'Model training',summary:'Train, fine-tune, and track metrics',body:'Choose memory, interconnects, and storage for training. Run tasks with familiar tools and review loss curves and training records.',image:'app-training-learning-v3.png',alt:'Groups of colorful image fragments progressively rearranged into stable visual patterns as a metaphor for learning',caption:'',source:'',tools:['PyTorch','JupyterLab','TensorBoard'],gpu:'H200'},
    {title:'Image generation',summary:'Create with visual workflows',body:'Organize models, prompts, and nodes in ComfyUI for creative and batch work. Set up your own environment or get deployment assistance.',image:'app-diffusion.jpg',alt:'Images generated with Stable Diffusion',caption:'',source:'',tools:['ComfyUI','Models and nodes','Generation workflows'],gpu:'RTX 5090'},
  ]
  const item=applications[selected]
  return <section className={`${layout.section} ${styles.section} ${styles.workloadsSection}`} id="ai-workloads" tabIndex={-1} aria-labelledby="ai-workloads-title"><div ref={carouselRef} className={layout.container} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(false)}}>
    <div className={layout.sectionHeading}><h2 id="ai-workloads-title">{zh?'从算力到应用 按需选择':'From compute to applications'}</h2><p>{zh?'自行使用算力，或由我们协助部署开源模型与业务应用':'Use compute yourself, or get help deploying open-source models and business applications'}</p></div>
    <div className={styles.workloadTabs} role="tablist" aria-label={zh?'选择应用场景':'Choose an application'}>{applications.map((app,index)=><button key={app.title} id={`workload-tab-${index}`} type="button" role="tab" aria-selected={selected===index} aria-controls="workload-panel" tabIndex={selected===index?0:-1} onMouseEnter={()=>{setKeyboardChange(false);setSelected(index)}} onClick={()=>{setKeyboardChange(false);setSelected(index)}} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%applications.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+applications.length-1)%applications.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=applications.length-1;else return;event.preventDefault();setKeyboardChange(true);setSelected(next);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()}}><strong>{app.title}</strong></button>)}</div>
    <div className={styles.applicationPanel} data-keyboard={keyboardChange} role="tabpanel" id="workload-panel" aria-labelledby={`workload-tab-${selected}`} tabIndex={0}>
      <div key={`visual-${selected}`} className={styles.applicationVisual}><figure className={styles.applicationImage}><div><img key={item.image} src={`${import.meta.env.BASE_URL}assets/${item.image}`} alt={item.alt} loading="lazy" decoding="async" data-photo="true"/></div></figure></div>
      <div key={`copy-${selected}`} className={styles.applicationCopy}><h3>{item.title}</h3><p>{item.body}</p><div className={styles.toolTags}>{item.tools.map(tool=><span key={tool}>{tool}</span>)}</div><div className={styles.applicationActions}>{item.gpu&&<button className={styles.rentPrimary} onClick={()=>open({type:'rent',query:item.gpu})}>{zh?'租用算力':'Rent compute'}<Icon name="arrow" size={16}/></button>}</div></div>

    </div>
  </div></section>
}
