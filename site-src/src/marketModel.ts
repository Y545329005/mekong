import { counts, history, listedGpus, marketData } from './content'
import type { Gpu, Region } from './content'
import { livePrice } from './live'

// Reference variants and theoretical FP32 throughput.
export const specifications: Record<string, { fp32: number; variant: string; link: string }> = {
  rtx5080: { fp32: 0, variant: 'PCIe', link: 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5080/' },
  rtx5090: { fp32: 0, variant: 'PCIe', link: 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/' },
  pro6000: { fp32: 0, variant: 'Blackwell', link: 'https://www.nvidia.com/en-us/products/workstations/rtx-pro/6000-blackwell/' },
  pro6000d: { fp32: 0, variant: 'D', link: '' },
  b300: { fp32: 0, variant: 'SXM', link: '' },
  gb300: { fp32: 0, variant: 'NVL72', link: 'https://www.nvidia.com/en-us/data-center/gb300-nvl72/' },
  h100: { fp32: 67, variant: 'SXM', link: 'https://www.nvidia.com/en-gb/data-center/h100/' },
  h200: { fp32: 67, variant: 'SXM', link: 'https://resources.nvidia.com/en-us-gpu-resources/hpc-datasheet-sc23?xs=443995' },
  a100: { fp32: 19.5, variant: 'SXM', link: 'https://resources.nvidia.com/en-us-gpu-resources/nvidia-a100-datashee-1?xs=443994' },
  rtx4090: { fp32: 82.6, variant: 'PCIe', link: 'https://images.nvidia.com/aem-dam/Solutions/geforce/ada/nvidia-ada-gpu-architecture.pdf' },
}
export function computePower(region: Region = 'all') {
  return marketData.reduce((sum, gpu) => sum + counts(gpu, region).total * (specifications[gpu.id]?.fp32 ?? 0), 0) / 1000
}
export function listingValue(region: Region = 'all') {
  return marketData.reduce((sum, gpu) => sum + counts(gpu, region).total * livePrice(gpu.prices[6], gpu.id), 0)
}
export function supplyHistory(gpu: Gpu, period: 1 | 7 | 30 | 'all', region: Region) {
  const current = counts(gpu, region)
  return history(gpu, period).map((entry, i, entries) => {
    const remaining = entries.length - 1 - i
    const rented = Math.min(current.total - current.reserved - current.offline, Math.max(0, current.rented + (remaining ? Math.round(Math.sin(i * 1.3) * current.total * .04 + remaining * current.total * .002) : 0)))
    return { date: entry.date, total: current.total, rented, available: current.total - current.reserved - current.offline - rented }
  })
}
export const locationPoints = [
  { id: 'sg', lon: 103.82, lat: 1.35, labelX: 724, labelY: 312 },
  { id: 'jp', lon: 139.69, lat: 35.68, labelX: 905, labelY: 125 },
  { id: 'kr', lon: 126.98, lat: 37.57, labelX: 732, labelY: 104 },
  { id: 'us', lon: -98.58, lat: 39.83, labelX: 142, labelY: 97 },
] as const
export function resourceGrade(gpuId: string, region: Exclude<Region, 'all'>) {
  if (gpuId === 'h100' || gpuId === 'h200') return region === 'sg' ? 2 : 1
  return gpuId === 'a100' ? 1 : 0
}

// Local daily price anchors, pending a backend OHLC feed.
// Cross-listing price ranges are not intraday highs/lows. Until intraday
// observations exist, the candle envelope is limited to its open and close.
export function priceDistributionHistory(gpu:Gpu,period:1|7|30|'all',region:Region) {
  const factor={all:1,sg:1.08,jp:1.03,kr:.97,us:.92}[region]
  const entries=history(gpu,period===1?7:period)
  const scale=gpu.median/gpu.prices[gpu.prices.length-1]*factor
  const rows=entries.map((entry,i)=>{
    const close=Number((entry.price*scale).toFixed(4))
    const open=i?Number((entries[i-1].price*scale).toFixed(4)):close
    return {date:entry.date,open,close,min:Math.min(open,close),median:close,max:Math.max(open,close)}
  })
  return period===1?rows.slice(-1):rows
}

const normaliseGpuQuery=(value:string)=>value.toLowerCase().replace(/[\s_-]+/g,'')
export function canonicalGpuQuery(value:string) {
  const term=value.trim(),key=normaliseGpuQuery(term)
  return listedGpus.find(gpu=>[gpu.id,gpu.name].some(name=>normaliseGpuQuery(name)===key))?.name??term
}
export function resolveGpuQueries(queries:readonly string[]) {
  const ids=new Set<string>()
  for(const query of queries) {
    const term=normaliseGpuQuery(query)
    if(!term)continue
    const exact=listedGpus.filter(gpu=>[gpu.id,gpu.name].some(name=>normaliseGpuQuery(name)===term))
    const matches=exact.length?exact:listedGpus.filter(gpu=>normaliseGpuQuery(`${gpu.name} ${gpu.memory} ${gpu.id}`).includes(term))
    for(const gpu of matches)ids.add(gpu.id)
  }
  return [...ids]
}
