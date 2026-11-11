/* ============================================================================
   宿主机器状态（演示态）：按邮箱隔离的挂牌价、上下架标记。
   与 wallet/store.ts 同一模式——挂载时读一次，变更即落盘；隐私模式下写失败
   只影响刷新后的记忆，不影响当前视图。
   挂牌状态＝（种子已挂牌 ∪ 本账号上架过）− 本账号下架过：上架/下架都可逆。
   挂牌价只改变宿主侧的供给视图与市场位置判断，不改写租客侧订单的成交价：
   进行中的租约永远按签约价结算。
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { HOST_MACHINES } from './hostMachines'

export type HostState = {
  /* 机器编号 → 整机挂牌时价（$/小时）；缺省时用 MACHINE_SPECS 的种子价 */
  prices: Record<string, number>
  /* 本账号下架过的机器编号 */
  unlisted: string[]
  /* 本账号上架过的机器编号（覆盖种子 listed=false 的机器） */
  listed: string[]
}

const emptyState = (): HostState => ({ prices: {}, unlisted: [], listed: [] })
const storeKey = (email: string) => `mekong.host.v1.${email}`
const known = new Set(HOST_MACHINES.map(machine => machine.id))

export function loadHost(email: string): HostState {
  if (!email) return emptyState()
  try {
    const raw = localStorage.getItem(storeKey(email))
    if (!raw) return emptyState()
    const saved = JSON.parse(raw) as Partial<HostState>
    const prices: Record<string, number> = {}
    if (saved.prices && typeof saved.prices === 'object') {
      for (const [id, value] of Object.entries(saved.prices)) {
        const price = Number(value)
        if (known.has(id) && Number.isFinite(price) && price > 0) prices[id] = price
      }
    }
    const pickIds = (value: unknown) => Array.isArray(value) ? value.filter(id => typeof id === 'string' && known.has(id)) : []
    return { prices, unlisted: pickIds(saved.unlisted), listed: pickIds(saved.listed) }
  } catch {
    return emptyState()
  }
}

export function saveHost(email: string, state: HostState) {
  try { localStorage.setItem(storeKey(email), JSON.stringify(state)) } catch { /* 隐私模式下不落盘 */ }
}

export function useHost(email: string) {
  const seed = useRef<HostState | null>(null)
  if (!seed.current) seed.current = loadHost(email)
  const [host, setHost] = useState(seed.current)
  useEffect(() => { if (email) saveHost(email, host) }, [email, host])
  return { host, setHost }
}
