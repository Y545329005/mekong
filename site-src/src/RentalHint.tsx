import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import s from './RentalHint.module.css'

let warmUntil = 0

export default function RentalHint({label, explanation, children}:{label:string;explanation:string;children:ReactNode}) {
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),tip=useRef<HTMLDivElement>(null)
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),pointer=useRef('keyboard')
 const [open,setOpen]=useState(false),[instant,setInstant]=useState(false),[position,setPosition]=useState({left:8,top:8})
 const cancel=()=>{clearTimeout(timer.current);timer.current=undefined}
 const close=()=>{cancel();setOpen(false)}
 const show=(immediate=false)=>{
  cancel()
  const skip=immediate||Date.now()<warmUntil
  setInstant(skip)
  const reveal=()=>{warmUntil=Date.now()+700;setOpen(true)}
  if(skip)reveal();else timer.current=setTimeout(reveal,300)
 }
 const leave=()=>{cancel();if(open)warmUntil=Date.now()+700;timer.current=setTimeout(()=>setOpen(false),140)}
 useEffect(()=>()=>clearTimeout(timer.current),[])
 useLayoutEffect(()=>{
  if(!open||!trigger.current||!tip.current)return
  const anchor=trigger.current.getBoundingClientRect(),box=tip.current.getBoundingClientRect()
  const left=Math.max(8,Math.min(anchor.left,window.innerWidth-box.width-8))
  const top=anchor.bottom+box.height+10<window.innerHeight?anchor.bottom+8:Math.max(8,anchor.top-box.height-8)
  setPosition({left,top})
  const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!tip.current?.contains(event.target as Node))close()}
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')close()}
  window.addEventListener('scroll',close,true);window.addEventListener('resize',close)
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
  return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open])
 return <><button type="button" ref={trigger} className={s.trigger} data-rental-hint aria-label={label} aria-describedby={open?id:undefined}
  onPointerEnter={event=>{if(event.pointerType==='mouse')show()}} onPointerLeave={event=>{if(event.pointerType==='mouse')leave()}}
  onKeyDown={()=>{pointer.current='keyboard'}} onPointerDown={event=>{pointer.current=event.pointerType}} onFocus={()=>{if(pointer.current!=='touch')show(true)}} onBlur={close}
  onClick={()=>{if(pointer.current==='touch'){cancel();setInstant(true);setOpen(value=>!value)}else show(true)}}>{children}</button>
 {open&&createPortal(<div ref={tip} id={id} role="tooltip" className={s.tooltip} data-instant={instant} style={position}
  onPointerEnter={cancel} onPointerLeave={leave}><strong>{label}</strong><p>{explanation}</p></div>,document.body)}</>
}
