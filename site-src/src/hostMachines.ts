/* 宿主机器演示种子（静态快照）
   · 机器编号与型号与资金页演示订单（wallet/store.ts seed）同源：
     「租客租的机器 ⊆ 宿主上架的机器」，两侧演示叙事闭合
   · region 参照供给目录聚合（demoInventory.ts）就近分配
   · 接入上架/下架操作时升级为按邮箱隔离的 store（同 wallet/store.ts 模式） */

export type HostMachineStatus = 'running' | 'idle'

export type HostMachine = {
  id: string
  gpu: string
  region: 'sg' | 'jp' | 'kr' | 'us'
  status: HostMachineStatus
  listedAt: number
}

const d = 86400000

export const HOST_MACHINES: HostMachine[] = [
  { id: 'M-05904012', gpu: 'RTX 5090 ×2', region: 'jp', status: 'running', listedAt: Date.now() - 60 * d },
  { id: 'M-01114008', gpu: 'A100 ×4', region: 'sg', status: 'running', listedAt: Date.now() - 90 * d },
  { id: 'M-07730119', gpu: 'RTX 4090 ×4', region: 'kr', status: 'idle', listedAt: Date.now() - 45 * d },
  { id: 'M-06250011', gpu: 'GB300 ×1', region: 'sg', status: 'idle', listedAt: Date.now() - 30 * d },
]
