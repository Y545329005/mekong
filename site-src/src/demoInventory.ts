// Each row is a distinct group of physical devices, not an alternative slice of one pool.
// gpuCount = GPUs per device; machines = physical device count.
export const demoMachines:{gpuId:string;region:'sg'|'jp'|'kr'|'us';gpuCount:number;machines:number}[]=[
  {gpuId:'rtx4090',region:'jp',gpuCount:4,machines:2},
  {gpuId:'rtx4090',region:'sg',gpuCount:1,machines:2},
  {gpuId:'rtx4090',region:'us',gpuCount:1,machines:2},
  {gpuId:'rtx5090',region:'sg',gpuCount:8,machines:5},
  {gpuId:'rtx5090',region:'jp',gpuCount:1,machines:3},
  {gpuId:'h100',region:'sg',gpuCount:8,machines:1},
  {gpuId:'h100',region:'jp',gpuCount:4,machines:2},
  {gpuId:'h200',region:'jp',gpuCount:8,machines:2},
  {gpuId:'a100',region:'sg',gpuCount:4,machines:1},
  {gpuId:'a100',region:'us',gpuCount:1,machines:1},
  {gpuId:'rtx5080',region:'sg',gpuCount:1,machines:3},
  {gpuId:'pro6000',region:'sg',gpuCount:4,machines:1},
  {gpuId:'pro6000',region:'jp',gpuCount:1,machines:1},
  {gpuId:'pro6000d',region:'sg',gpuCount:1,machines:1},
  {gpuId:'b300',region:'sg',gpuCount:8,machines:2},
  {gpuId:'b300',region:'jp',gpuCount:8,machines:1},
  {gpuId:'h100',region:'kr',gpuCount:8,machines:3},
  {gpuId:'h200',region:'sg',gpuCount:8,machines:3},
  {gpuId:'rtx4090',region:'kr',gpuCount:1,machines:7},
]
