import { demoMachines } from './demoInventory'
import { vastSnapshot } from './vastOfferSnapshot'

// Local inventory snapshot: historical rented samples plus selected public offer references.
// Select one allocation per physical machine so alternative slices are never added twice.
const availableOfferIds=new Set(['48989683','43688757','28539924','45380573','50103209','47877848','57917101','55827689','57867522','30720259','56665364','45172707','47379027','45315037','28418865','58297923'])
export const availableSnapshotRows=vastSnapshot.rows.filter(row=>availableOfferIds.has(row[0]))
export type InventoryGroup={gpuId:string;region:'sg'|'jp'|'kr'|'us';gpuCount:number;machines:number;status:'available'|'rented'}
export const inventoryGroups:InventoryGroup[]=[
 ...demoMachines.map(row=>({...row,status:'rented' as const})),
 ...availableSnapshotRows.map(row=>({gpuId:row[2].includes('5090')?'rtx5090':'h200',region:row[1].endsWith('KR')?'kr' as const:row[1].endsWith('JP')?'jp' as const:'us' as const,gpuCount:Number(row[2].split('x ')[0]),machines:1,status:'available' as const})),
]
