export type MarketTab = 'supply' | 'prices' | 'geography'
export type ModalState =
  | { type: 'inquiry' }
  | { type: 'rent'; query?: string; region?: Region }
  | { type: 'page'; page: 'serverless' | 'clusters' }
  | { type: 'market'; query: string; tab: MarketTab; region?: Region }
  | { type: 'resource'; gpuId: string; region: Exclude<Region, 'all'> }
  | { type: 'guide'; title: string; description: string; points: readonly string[] }
  | null
import type { Region } from './content'


export type DialogState = Exclude<ModalState, {type:'inquiry'|'market'|'rent'|'page'}>
