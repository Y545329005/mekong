import { marketData, regions } from './content'
import type { Gpu, Region } from './content'
import { vastSnapshot } from './vastOfferSnapshot'
import { availableSnapshotRows } from './inventory'
import { demoMachines } from './demoInventory'

export type Verification = 'unverified' | 'verified' | 'secure'
export type Offer = {
  sourceId: string; sourceUrl: string; capturedOn: string; hourlyPrice: number; duration: string;
  id: string; machineIds: string[]; providerId: string; gpu: Gpu; region: Exclude<Region,'all'>; city: string
  count: number; units: number; status: 'rented'|'available'; cpu: number; ram: number; cpuModel: string; arch: 'x86_64'|'arm64'
  disk: number; diskSpeed: number; volumeMax: number; upload: number; download: number; ports: number
  reliability: number; days: number; verification: Verification; staticIp: boolean|null; cuda: number
  pcie: number; pcieLanes: number; pcieBandwidth: number; memoryBandwidth: number; nvlink: number; driver: string|null
  fp32Tflops: number; cpuTotal: number; cpuGhz: number|null; ramTotal: number; motherboard: string
  diskModel: string; diskTotal: number|null; diskWriteSpeed: number|null
}
// Each row is one public offer; configurations on the same physical machine remain alternatives.
const availableOffers: Offer[] = availableSnapshotRows.map(row => {
  const [sourceId,location,model,tf,machine,provider,verified,vram,memBw,board,pcie,lanes,pcieBw,cpuModel,cpu,cpuTotal,ram,ramTotal,diskModel,diskSpeed,disk,upload,download,ports,cuda,duration,reliability,hourlyPrice] = row
  const count=Number(model.split('x ')[0]), name=model.split('x ')[1]
  const modelId=name.includes('5090')?'rtx5090':name.includes('5080')?'rtx5080':name.includes('4090')?'rtx4090':name.includes('H200')?'h200':'a100'
  const base=marketData.find(gpu=>gpu.id===modelId)!
  const region:Exclude<Region,'all'>=location.endsWith('KR')?'kr':location.endsWith('JP')?'jp':'us'
  const subdivision=location.split(', ')[0]
  const city=['South Korea','Japan','United States'].includes(subdivision)?'':subdivision
  // Duration filters use 30 days per advertised month; the original term is displayed unchanged.
  const months=Number(duration.match(/(\d+) mon/)?.[1]??0), daysPart=Number(duration.match(/(\d+)\s*d/)?.[1]??0)
  return {
    id:`vast-${sourceId}`,sourceId,sourceUrl:vastSnapshot.source,capturedOn:vastSnapshot.capturedOn,
    machineIds:[machine],providerId:provider,gpu:{...base,name,memory:`${vram} GB`},region,city,
    count,units:1,status:'available',cpu,ram,cpuModel,arch:'x86_64',disk,diskSpeed,volumeMax:0,
    upload,download,ports,reliability,days:months*30+daysPart,duration,
    verification:verified?'verified':'unverified',staticIp:null,cuda,pcie,pcieLanes:lanes,pcieBandwidth:pcieBw,
    memoryBandwidth:memBw,nvlink:0,driver:null,fp32Tflops:tf/count,cpuTotal,cpuGhz:null,ramTotal,
    motherboard:board,diskModel,diskTotal:null,diskWriteSpeed:null,hourlyPrice,
  }
})
const cities = [['Singapore','Singapore'],['Tokyo','Osaka'],['Seoul','Busan'],['Ashburn','Dallas']]
const cpuModels = ['AMD EPYC 7543','Intel Xeon Gold 6338','AMD Threadripper PRO 5975WX','AMD EPYC 9354']
const serverCpus = ['AMD EPYC 9654','Intel Xeon Platinum 8480+','AMD EPYC 9754','Intel Xeon Platinum 8570']
const memoryBandwidth:Record<string,number>={rtx4090:1008,rtx5080:960,rtx5090:1792,pro6000:1600,pro6000d:1600,a100:2039,h100:3350,h200:4800,b300:8000,gb300:8000}
// Representative telemetry, not manufacturer specifications or live measurements.
const performanceFixtures:Record<string,number>={rtx4090:79.6,rtx5080:53.1,rtx5090:98.2,pro6000:112.5,pro6000d:105.8,a100:18.4,h100:58.7,h200:59.3,b300:74.8,gb300:75.4}
const storageFixtures=['Samsung PM9A3','Micron 7450 PRO','KIOXIA CD8P','Solidigm D7-P5520']
const boardFixtures=['Supermicro H12SSL-i','Supermicro X12DPG-QT6','ASUS Pro WS WRX80E-SAGE','Supermicro H13SSL-NT']
// Device configurations come directly from the shared physical-machine inventory.
const rentedOffers: Offer[] = marketData.flatMap((gpu, modelIndex) => regions.slice(1).flatMap((location, regionIndex) => {
  return demoMachines.filter(row=>row.gpuId===gpu.id&&row.region===location.id).flatMap(({gpuCount:count,machines:units}) => {
    const high = ['a100','h100','h200','b300','gb300'].includes(gpu.id)
    const profile=(modelIndex+regionIndex+Math.log2(count))%4|0
    const rack=Boolean(gpu.systemGpus), blackwell=['rtx5080','rtx5090','pro6000','pro6000d','b300','gb300'].includes(gpu.id)
    const secure=rack||(high&&regionIndex!==2)||(count>=4&&regionIndex===0)
    const verification:Verification=secure?'secure':(modelIndex+regionIndex+count)%5===0?'unverified':'verified'
    const vram=parseInt(gpu.memory),ramPerGpu=Math.max([32,64,96,128][profile],vram>=80?Math.ceil(vram/64)*64:32)
    const cpu=rack?2592:count*(high?[16,24,32,24][profile]:[8,12,16,8][profile])
    const ram=rack?18432:count*ramPerGpu
    const disk=count*[256,512,960,1920][profile]
    const diskSpeed=[2800,4200,6500,9800][profile]
    return [{
      id:`MK-${String(modelIndex+1).padStart(2,'0')}${regionIndex+1}${count}`,
      machineIds:Array.from({length:units},(_,index)=>`M-${String(modelIndex+1).padStart(2,'0')}${regionIndex+1}${String(count).padStart(2,'0')}${String(index+1).padStart(3,'0')}`),
      sourceId:'',sourceUrl:'',capturedOn:'',hourlyPrice:gpu.prices[6]*count,duration:`${[14,30,60,90][profile]} days`,
      providerId:`P-${1100+regionIndex*100+modelIndex%3+1}`,gpu,region:location.id as Exclude<Region,'all'>,
      city:cities[regionIndex][(modelIndex+count)%2],count,units,status:'rented' as const,
      cpu,ram,cpuModel:rack?'36 × NVIDIA Grace':(high?serverCpus:cpuModels)[profile],arch:rack?'arm64':'x86_64',
      disk,diskSpeed,
      fp32Tflops:Number((performanceFixtures[gpu.id]*(1-profile*.012)).toFixed(1)),
      cpuTotal:rack?2592:Math.max(cpu,Math.ceil(cpu/64)*64),cpuGhz:[2.8,2.0,3.6,3.25][profile],
      ramTotal:rack?18432:Math.max(ram,Math.ceil(ram*2/256)*256),
      motherboard:rack?'NVIDIA GB300 NVL72':high?'GPU Server Baseboard':boardFixtures[profile],
      diskModel:storageFixtures[profile],diskTotal:Math.max(disk,[1920,3840,3840,7680][profile]*Math.max(1,Math.ceil(count/4))),
      diskWriteSpeed:Math.round(diskSpeed*[.76,.8,.84,.86][profile]/10)*10,
      volumeMax:regionIndex===2?0:[2000,4000,8000,4000][profile],
      upload:high?[10000,10000,25000,40000][profile]:[1000,2500,1000,10000][profile],
      download:high?[10000,25000,25000,40000][profile]:[2000,2500,5000,10000][profile],ports:[16,64,128,256][profile],
      reliability:Number((verification==='unverified'?97.2+profile*.3:99.5+profile*.12+regionIndex*.03).toFixed(2)),
      days:rack?180:[14,30,60,90][profile],verification,staticIp:regionIndex%2===0,
      cuda:blackwell?13:profile%2?12.8:12.4,pcie:blackwell||high&&gpu.id!=='a100'?5:4,
      pcieLanes:16,pcieBandwidth:blackwell||high&&gpu.id!=='a100'?[48,52,54,56][profile]:[24,25,27,28][profile],
      memoryBandwidth:memoryBandwidth[gpu.id],nvlink:high&&count>1?(rack?1800:gpu.id==='a100'?600:900):0,
      driver:blackwell?'580.65.06':profile%2?'570.133.20':'550.163.01',
    }]
  })
}))
export const offers:Offer[]=[...availableOffers,...rentedOffers]
export const rentalModels=marketData.filter(gpu=>offers.some(o=>o.gpu.id===gpu.id)).map(gpu=>{const choices=offers.filter(o=>o.gpu.id===gpu.id);return {...gpu,name:gpu.id==='h200'?'H200 NVL':gpu.name,memory:[...new Set(choices.map(o=>parseInt(o.gpu.memory)))].sort((a,b)=>a-b).join(' / ')+' GB'}})
export const recommendationRank=new Map(offers.map((offer,index)=>[offer.id,index]))
export type RentalMode = 'on-demand'|'reserved'|'elastic'
export function offerPrice(offer: Offer, _mode: RentalMode) { return offer.hourlyPrice }
export function findModel(query: string) { const normalized=query.toLowerCase().replace(/[\s-]/g,'');if(normalized==='h200nvl')return 'h200';return marketData.find(gpu=>gpu.name.toLowerCase().replace(/[\s-]/g,'')===normalized||gpu.id===normalized)?.id ?? '' }
export type RentalFilters={disk:number;volume:number;reliability:number;days:number;secure:boolean;unverified:boolean;staticIp:boolean;cuda:number;priceMin:number;priceMax:number;vram:number;totalVram:number;cores:number;ram:number;net:number;upload:number;ports:number;diskSpeed:number;nvlink:number;arch:string}
export const defaultFilters:RentalFilters={disk:32,volume:0,reliability:90,days:1,secure:false,unverified:true,staticIp:false,cuda:0,priceMin:0,priceMax:500,vram:0,totalVram:0,cores:0,ram:0,net:0,upload:0,ports:0,diskSpeed:0,nvlink:0,arch:'all'}

function normalize(value:string) { return value.normalize('NFKC').toLowerCase().replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/(\d)\s+(gb|tb|mbps|gbps|mb\/s|gb\/s)/g,'$1$2').replace(/cuda\s+(\d)/g,'cuda$1').replace(/(vram|显存|ram|内存|cpu|vcpu|disk|磁盘|cuda|price|价格|network|下行)\s*(>=|<=|>|<|=)\s*(\d)/g,'$1$2$3') }
export function matchesOffer(offer:Offer,query:string,mode:RentalMode) {
 const region=regions.find(item=>item.id===offer.region)!
 const tier=offer.verification==='secure'?'secure 企业级':offer.verification==='unverified'?'unverified 未验证':'verified 已验证'
 const text=normalize(`${offer.gpu.name} ${offer.id} ${offer.machineIds.join(' ')} ${offer.providerId} ${region.zh} ${region.en} ${offer.city} ${offer.cpuModel} ${offer.arch} ${offer.motherboard} ${offer.diskModel} ${offer.fp32Tflops}tflops ${offer.cpuGhz?`${offer.cpuGhz}ghz`:""} ${tier} ${offer.gpu.memory} ${offer.ram}GB ${offer.disk}GB ${offer.diskSpeed}MB/s ${offer.cpu}cpu ${offer.cpu}vCPU cuda${offer.cuda.toFixed(1)} ${offer.upload}Mbps ${offer.download}Mbps ${offer.upload/1000}Gbps ${offer.download/1000}Gbps pcie${offer.pcie}.0 ${offer.staticIp?'固定ip staticip':''} ${offer.nvlink?'nvlink':''}`)
 return normalize(query).trim().split(/\s+/).filter(Boolean).every(token=>{
  const condition=token.match(/^(vram|显存|ram|内存|cpu|vcpu|disk|磁盘|cuda|price|价格|network|下行)(>=|<=|>|<|=)(\d+(?:\.\d+)?)(gb|tb|mbps|gbps)?$/)
  if(!condition)return text.includes(token)||text.replace(/\s/g,'').includes(token)
  const [,field,operator,number,unit]=condition
  const values:Record<string,number>={vram:parseInt(offer.gpu.memory),显存:parseInt(offer.gpu.memory),ram:offer.ram,内存:offer.ram,cpu:offer.cpu,vcpu:offer.cpu,disk:offer.disk,磁盘:offer.disk,cuda:offer.cuda,price:offerPrice(offer,mode),价格:offerPrice(offer,mode),network:offer.download,下行:offer.download}
  const target=Number(number)*(unit==='tb'?1000:unit==='gbps'?1000:1),actual=values[field]
  return operator==='>='?actual>=target:operator==='<='?actual<=target:operator==='>'?actual>target:operator==='<'?actual<target:actual===target
 })
}
export function filterOffers({filters:f,query='',models=[],region='all',count=0,mode='on-demand',template=''}:{filters:RentalFilters;query?:string;models?:string[];region?:Region;count?:number;mode?:RentalMode;template?:string}) {
 const env=templates.find(item=>item.id===template)
 return offers.filter(o=>mode==='on-demand'&&(!models.length||models.includes(o.gpu.id))&&(region==='all'||o.region===region)&&(!count||(count===9?o.count>=9:o.count===count))&&matchesOffer(o,query,mode)&&o.disk>=f.disk&&o.volumeMax>=f.volume&&o.reliability>=f.reliability&&o.days>=f.days&&(!f.secure||o.verification==='secure')&&(f.unverified||o.verification!=='unverified')&&(!f.staticIp||o.staticIp)&&o.cuda>=Math.max(f.cuda,env?.minCuda??0)&&offerPrice(o,mode)>=f.priceMin&&offerPrice(o,mode)<=f.priceMax&&parseInt(o.gpu.memory)>=Math.max(f.vram,env?.minVram??0)&&parseInt(o.gpu.memory)*o.count>=f.totalVram&&o.cpu>=f.cores&&o.ram>=f.ram&&o.download>=f.net&&o.upload>=f.upload&&o.ports>=f.ports&&o.diskSpeed>=f.diskSpeed&&o.nvlink>=f.nvlink&&(f.arch==='all'||o.arch===f.arch))
}
export const templates = [
  {id:'pytorch',name:'PyTorch',image:'pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime',description:['训练、微调与实验','Training, fine-tuning and experiments'],connection:'JupyterLab / SSH',minCuda:12.8,minVram:8},
  {id:'vllm',name:'vLLM',image:'vllm/vllm-openai:v0.9.2',description:['模型推理与 API 服务','Model inference and API services'],connection:'HTTP API / SSH',minCuda:12.8,minVram:24},
  {id:'comfy',name:'ComfyUI',image:'mekong/comfyui:cuda12.8',description:['图像、视频与生成工作流','Image, video and generative workflows'],connection:'Web UI / SSH',minCuda:12.8,minVram:16},
  {id:'ubuntu',name:'Ubuntu',image:'ubuntu:24.04',description:['自行配置运行环境','Configure your own environment'],connection:'SSH',minCuda:0,minVram:0},
]
