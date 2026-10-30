import { listedGpus } from './content'
import type { Region } from './content'
import { offers } from './rentalModel'
import { supplyDrift } from './live'
import snapshot from './vastPriceSnapshot.json'

export type Inventory = { gpuId: string; total: number; machines:number; configurations:{gpuCount:number;machines:number}[]; available: number; rented: number; reserved: number; offline: number }
export const priceSource = snapshot.source
export const priceUpdated = snapshot.updated
const keys: Record<string,string> = { rtx4090:'rtx 4090',rtx5090:'rtx 5090',rtx5080:'rtx 5080',h100:'h100 sxm',h200:'h200',a100:'a100 sxm4',b300:'b300',gb300:'gb300' }
export function referenceHistory(id:string) {
  const data=snapshot.gpus as Record<string,{name:string;daily:{date:string;median:number}[]}>
  const record=data[keys[id]]
  return record?{name:record.name,entries:record.daily.map(item=>({date:item.date,price:item.median}))}:null
}
export function getHomeMarket() {
  // Derive the homepage from the same machine rows shown in the marketplace.
  // 可租数与行情页 counts() 用同一漂移键（gpuId:region），两处数字同源同跳。
  const inventory:Inventory[]=listedGpus.map(gpu=>{
    const rows=offers.filter(offer=>offer.gpu.id===gpu.id)
    const machines=rows.reduce((sum,offer)=>sum+offer.units,0)
    const grouped=new Map<number,number>()
    for(const row of rows)grouped.set(row.count,(grouped.get(row.count)??0)+row.units)
    const configurations=[...grouped].sort(([a],[b])=>b-a).map(([gpuCount,machines])=>({gpuCount,machines}))
    const byRegion=new Map<Exclude<Region,'all'>,{pool:number;available:number}>()
    for(const row of rows){
      const entry=byRegion.get(row.region)??{pool:0,available:0}
      entry.pool+=row.units*row.count
      if(row.status==='available')entry.available+=row.units*row.count
      byRegion.set(row.region,entry)
    }
    let total=0,available=0
    for(const [regionId,entry] of byRegion){
      const drifted=Math.min(supplyDrift(`${gpu.id}:${regionId}`,entry.available),entry.pool)
      total+=entry.pool;available+=drifted
    }
    return {gpuId:gpu.id,total,machines,configurations,available,rented:total-available,reserved:0,offline:0}
  })
  const featured=listedGpus
  const totals=inventory.reduce((sum,row)=>({total:sum.total+row.total,machines:sum.machines+row.machines,available:sum.available+row.available,rented:sum.rented+row.rented,reserved:sum.reserved+row.reserved,offline:sum.offline+row.offline}),{total:0,machines:0,available:0,rented:0,reserved:0,offline:0})
  return {inventory,featured,totals}
}
