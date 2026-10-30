import { useEffect, useState } from 'react'

// 演示数据的「时间行为」分两层：
//   1) 日级序列：每天收一个点，轴随日历滚动（同一天数值恒定，可复现）；
//   2) 实时聚合：可租数、挂牌价在基准附近小幅漂移（分钟/十秒级跳动）。
// 全部用确定性伪随机（种子=数据键+时间桶）：同一桶内刷新页面数值一致，
// 像真实行情站——刷新不变、过几分钟变；跨桶演进、无跳变抽疯。

const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const random=(seed:number)=>{let s=seed;return()=>{s=Math.imul(s^s>>>15,s|1);s^=s+Math.imul(s^s>>>7,s|61);return((s^s>>>14)>>>0)/4294967296}}

// 桶节奏：可租数 20s 一格、价格 60s 一格；UI 由 useLiveTick 每 10s 重渲染驱动。
const SUPPLY_STEP=20_000, PRICE_STEP=60_000
const bucket=(stepMs:number)=>Math.floor(Date.now()/stepMs)

// 库存整数漂移：±cap 内，库存越少波动越小（0 保持 0，「已租满」不乱翻）。
export function supplyDrift(key:string,available:number,cap=2){
  const rand=random(hash(`${key}:${bucket(SUPPLY_STEP)}`))
  const drift=Math.round((rand()-.5)*2*cap*Math.min(1,available/6))
  return Math.max(0,available+drift)
}

// 日间噪声（±1）：种子=数据键+UTC 日期，历史序列每天一格、跨天确定。
export function dayNoise(key:string,date:string){
  return random(hash(`${key}:${Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000)}`))()*2-1
}

// 实时挂牌价：日内 ±1% 漂移，round 到分；低价卡常保持原值（真实：低价卡分钟级几乎不动）。
export function livePrice(base:number,key:string){
  const rand=random(hash(`${key}:${bucket(PRICE_STEP)}`))
  return Math.max(.01,Math.round(base*(1+(rand()-.5)*.02)*100)/100)
}

// 驱动重渲染：页面隐藏时暂停，回到前台立即拉齐一次。
export function useLiveTick(stepMs=10_000){
  const [tick,setTick]=useState(0)
  useEffect(()=>{
    let visible=!document.hidden
    const sync=()=>{if(!document.hidden)setTick(value=>value+1);visible=!document.hidden}
    const id=setInterval(()=>{if(visible)setTick(value=>value+1)},stepMs)
    document.addEventListener('visibilitychange',sync)
    return()=>{clearInterval(id);document.removeEventListener('visibilitychange',sync)}
  },[stepMs])
  return tick
}
