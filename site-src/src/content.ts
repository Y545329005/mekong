import { availableSnapshotRows, inventoryGroups } from './inventory'
import { dayNoise, livePrice, supplyDrift } from './live'
export type Language = 'zh' | 'en'
export type Region = 'all' | 'sg' | 'jp' | 'kr' | 'us'
export const regions: { id: Region; zh: string; en: string }[] = [
  { id: 'all', zh: '全球地区', en: 'All regions' }, { id: 'sg', zh: '新加坡', en: 'Singapore' },
  { id: 'jp', zh: '日本', en: 'Japan' }, { id: 'kr', zh: '韩国', en: 'South Korea' }, { id: 'us', zh: '美国', en: 'United States' },
]
export const copy = {
  zh: {
    nav: ['算力市场', '价格与行情', '企业算力'],
    sales: '联系销售', eyebrow: 'MEKONG GPU CLOUD', heading: ['全球算力，', '触手可及'],
    intro: '连接全球 GPU 供给，为模型训练、推理与内容创作提供算力。', detail: '从单卡到集群，灵活选择资源、租期与交付方式。',
    searchPlaceholder: '搜索 GPU 型号、显存或地区', searchLabel: '搜索算力资源', browse: '浏览算力', enterprise: '企业专属算力', services: ['按需租用', '预定容量', '弹性容量'],
    market: '算力市场', total: 'GPU 总量', available: '可租', running: '运行中', reserved: '已预约', offline: '维护 / 离线',
    supply: '资源供需', prices: '价格分布', geography: '地域分布', listing: '挂牌起价', median: '挂牌中位价', range: '主流挂牌区间',
    cards: '卡', hour: '/ 卡 / 小时', totalLabel: '总量', rented: '已租', trend: '价格走势', sevenDays: '7 天', thirtyDays: '30 天',
    priceBasis: '美元 / 卡 / 小时', allResources: '查看全部资源', reset: '重置筛选', noResults: '暂无匹配的资源', query: '搜索资源',
    resourceName: 'GPU 型号', region: '地区', memory: '显存', 
    docBody: '集中查看实例、用量和账单，按任务安排算力。企业需求可通过联系销售沟通。', close: '关闭', understood: '知道了', regionPlaceholder: '例如：新加坡、日本',
    durationOptions: ['1 个月以内', '1–3 个月', '3–12 个月', '12 个月以上'], tooltip: '挂牌起价', skip: '跳到主要内容', overview: '平台资源概览', quoteValue: '挂牌总价', },
  en: {
    nav: ['GPU Marketplace', 'Pricing', 'Enterprise'],
    sales: 'Contact Sales', eyebrow: 'MEKONG GPU CLOUD', heading: ['Global compute', 'Within reach'], intro: 'Global GPU supply for model training, inference, and creative workloads.', detail: 'From a single GPU to an enterprise cluster. Choose the resources, duration, and delivery you need.',
    searchPlaceholder: 'Search GPU model, memory, or location', searchLabel: 'Search compute resources', browse: 'Explore GPUs', enterprise: 'Enterprise compute', services: ['On-demand', 'Reserved', 'Elastic capacity'],
    market: 'Compute market', total: 'Total GPUs', available: 'Available', running: 'Running', reserved: 'Reserved', offline: 'Maintenance / offline',
    supply: 'Supply & demand', prices: 'Price distribution', geography: 'Locations', listing: 'Starting price', median: 'Median listing', range: 'Typical listing range', cards: 'GPUs', hour: '/ GPU / hr', totalLabel: 'Total', rented: 'Rented', trend: 'Price trend', sevenDays: '7 days', thirtyDays: '30 days',
    priceBasis: 'USD / GPU / hr', allResources: 'View all GPUs', reset: 'Reset filters', noResults: 'No matching resources', query: 'Search resources', resourceName: 'GPU model', region: 'Location', memory: 'VRAM',
    docBody: 'Organize instances, usage, and billing around your work. For enterprise requirements, contact our sales team.', close: 'Close', understood: 'Got it', regionPlaceholder: 'e.g. Singapore, Japan', durationOptions: ['Under 1 month', '1–3 months', '3–12 months', 'Over 12 months'], tooltip: 'Starting listing price', skip: 'Skip to main content', overview: 'Platform overview', quoteValue: 'Total listing value', },
}
export type Copy = typeof copy[Language]
type Supply = { total: number; available: number; rented: number; reserved: number; offline: number }
export type Gpu = { systemGpus?: number; id: string; name: string; memory: string; prices: number[]; median: number; range: [number, number]; locations: Record<Exclude<Region, 'all'>, Supply> }
const supply = (total: number, available: number, rented: number, reserved: number, offline: number): Supply => ({ total, available, rented, reserved, offline })
// All prices, quantities and locations are reference values, not a live inventory feed.
export const marketData: Gpu[] = [
  { id: 'h100', name: 'H100', memory: '80 GB', prices: [2.08, 2.02, 2.05, 1.96, 1.98, 1.92, 1.89], median: 2.14, range: [1.89, 2.49], locations: { sg: supply(96,48,32,8,8), jp: supply(64,32,24,8,0), kr: supply(64,32,24,0,8), us: supply(32,16,16,0,0) } },
  { id: 'h200', name: 'H200', memory: '141 GB', prices: [2.68, 2.64, 2.66, 2.61, 2.57, 2.54, 2.49], median: 2.79, range: [2.49, 3.29], locations: { sg: supply(32,16,8,0,8), jp: supply(16,8,8,0,0), kr: supply(16,8,0,0,8), us: supply(0,0,0,0,0) } },
  { id: 'a100', name: 'A100', memory: '80 GB', prices: [1.02, .98, 1.01, .95, .92, .94, .89], median: 1.08, range: [.89, 1.39], locations: { sg: supply(64,32,16,8,8), jp: supply(64,32,24,8,0), kr: supply(32,16,8,0,8), us: supply(32,16,16,0,0) } },
  { id: 'rtx4090', name: 'RTX 4090', memory: '24 GB', prices: [.31, .33, .32, .34, .33, .36, .35], median: .41, range: [.35, .59], locations: { sg: supply(128,64,32,24,8), jp: supply(128,64,32,32,0), kr: supply(128,48,48,24,8), us: supply(128,64,48,16,0) } },
  ...[
    ['rtx5080','RTX 5080','16 GB',.29,192],
    ['rtx5090','RTX 5090','32 GB',.59,192],
    ['pro6000','RTX PRO 6000','96 GB',1.29,128],
    ['pro6000d','RTX PRO 6000D','96 GB',1.19,64],
    ['b300','B300','288 GB',4.89,32],
  ].map(([id,name,memory,price,total]) => {
    const amount=Number(total), unit=Number(price)
    return {id:String(id),name:String(name),memory:String(memory),prices:[1.09,1.06,1.08,1.04,1.03,1.01,1].map(v=>Number((v*unit).toFixed(2))),median:Number((unit*1.15).toFixed(2)),range:[unit,Number((unit*1.4).toFixed(2))] as [number,number],locations:{sg:supply(amount/2,amount/4,amount/8,amount/16,amount/16),jp:supply(amount/4,amount/8,amount/16,amount/16,0),kr:supply(0,0,0,0,0),us:supply(amount/4,amount/8,amount/8,0,0)}}
  }),
  {id:'gb300',name:'GB300 NVL72',memory:'288 GB / GPU',systemGpus:72,prices:[6.2,6.15,6.12,6.05,5.99,5.94,5.89],median:6.19,range:[5.89,6.79],locations:{sg:supply(72,72,0,0,0),jp:supply(0,0,0,0,0),kr:supply(0,0,0,0,0),us:supply(0,0,0,0,0)}},

]
// Card inventory is derived from physical devices × GPUs per device.
for(const gpu of marketData){
  regions.slice(1).forEach(region=>{
    const rows=inventoryGroups.filter(row=>row.gpuId===gpu.id&&row.region===region.id)
    const total=rows.reduce((sum,row)=>sum+row.machines*row.gpuCount,0)
    const available=rows.filter(row=>row.status==='available').reduce((sum,row)=>sum+row.machines*row.gpuCount,0)
    gpu.locations[region.id as Exclude<Region,'all'>]=supply(total,available,total-available,0,0)
  })
}
// The current per-GPU listing price uses the same available offers as the rental page.
for(const gpu of marketData){
 const rows=availableSnapshotRows.filter(row=>(row[2].includes('5090')?'rtx5090':'h200')===gpu.id)
 if(!rows.length)continue
 const prices=rows.map(row=>row[27]/Number(row[2].split('x ')[0])).sort((a,b)=>a-b)
 gpu.prices[gpu.prices.length-1]=prices[0]
 gpu.median=prices.length%2?prices[(prices.length-1)/2]:(prices[prices.length/2-1]+prices[prices.length/2])/2
 gpu.range=[prices[0],prices[prices.length-1]]
}
marketData.sort((a,b)=>['rtx4090','rtx5080','rtx5090','pro6000','pro6000d','a100','h100','h200','b300','gb300'].indexOf(a.id)-['rtx4090','rtx5080','rtx5090','pro6000','pro6000d','a100','h100','h200','b300','gb300'].indexOf(b.id))
export function counts(gpu: Gpu, region: Region = 'all'): Supply {
  const merge=(a:Supply,b:Supply)=>({total:a.total+b.total,available:a.available+b.available,rented:a.rented+b.rented,reserved:a.reserved+b.reserved,offline:a.offline+b.offline})
  if (region === 'all') return Object.values(gpu.locations).reduce(merge, supply(0,0,0,0,0))
  const base=gpu.locations[region]
  // 可租数在基准附近随行情漂移（同键同桶恒定）；已租数吸收波动，总量守恒。
  const available=Math.min(supplyDrift(`${gpu.id}:${region}`,base.available),base.total-base.reserved-base.offline)
  return {...base,available,rented:base.total-base.reserved-base.offline-available}
}
export function totals(region: Region = 'all'): Supply {
  return marketData.map(gpu => counts(gpu, region)).reduce((a,b) => ({total:a.total+b.total,available:a.available+b.available,rented:a.rented+b.rented,reserved:a.reserved+b.reserved,offline:a.offline+b.offline}), supply(0,0,0,0,0))
}
// 对客展示只列有供给的卡型——真实行情站不列零供给 SKU（GB300 NVL72 无设备行，走询价叙事）。
export const listedGpus = marketData.filter(gpu => counts(gpu, 'all').total > 0)
// 历史序列的日期轴以「今天（UTC）」为末日滚动，跨天推进，不再冻结在快照日期。
export function recentDates(count:number){
  const now=new Date()
  return Array.from({length:count},(_,index)=>{
    const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(count-1-index)))
    return day.toISOString().slice(0,10)
  })
}
export function history(gpu: Gpu, period: 1 | 7 | 30 | 'all') {
  // 序列统一锚定当前挂牌价（prices[6]）：prices[0..5] 是旧口径静态值，与快照实价不同源，
  // 直接拼接会制造假趋势（实测 H200「较7天前 +40%」）。日间噪声 ±3%，末日点=实时价。
  const anchor=gpu.prices[gpu.prices.length-1]
  if (period === 1) return [{price:livePrice(anchor,gpu.id),date:recentDates(1)[0]}]
  if (period === 7) {
    const dates=recentDates(7)
    return gpu.prices.map((_, i) => ({price:i===6?livePrice(anchor,gpu.id):Number((anchor*(1+dayNoise(gpu.id,dates[i])*.03)).toFixed(3)), date: dates[i]}))
  }
  const dates=recentDates(30), before=dates.slice(0,23)
  const pre = before.map((date, i) => ({price:Number((anchor*(1.10-i*.004+Math.sin(i*1.7)*.016)).toFixed(2)),date}))
  return [...pre,...gpu.prices.map((_,i)=>({price:i===6?livePrice(anchor,gpu.id):Number((anchor*(1+dayNoise(gpu.id,dates[23+i])*.03)).toFixed(3)),date:dates[23+i]}))]
}
