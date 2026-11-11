/* ============================================================================
   机器规格快照（计费引擎与段凭证共用 · 无依赖）
   MACHINE_SPECS 为种子机器口径；未知机器（真实下单的新机）走 FALLBACK_SPEC。
   带宽计量口径：bandwidth_mbps 即上游使用计量（容量占用），费率 $/Mbps·hr。
   ========================================================================== */

/* 带宽费率 $/Mbps·hr（v3.9 换轴口径：≈旧 $0.02/GB 流量口径的收入量级） */
export const RATE_BW_MBPS_H = 0.000233

export type MachineSpec = { dph: number; bwMbps: number; diskGb: number; gpu: string; vcpu: number; memMb: number }

export const MACHINE_SPECS: Record<string, MachineSpec> = {
  'M-08820041': { dph: 2.49, bwMbps: 50, diskGb: 360, gpu: 'B200 ×1', vcpu: 32, memMb: 65536 },
  'M-01822301': { dph: 1.85, bwMbps: 30, diskGb: 240, gpu: 'L40S ×1', vcpu: 16, memMb: 32768 },
  'M-05904012': { dph: 2.16, bwMbps: 30, diskGb: 240, gpu: 'RTX 5090 ×2', vcpu: 24, memMb: 49152 },
  'M-05111209': { dph: 2.2, bwMbps: 40, diskGb: 240, gpu: 'H200 NVL ×1', vcpu: 20, memMb: 40960 },
  'M-01114008': { dph: 3.7, bwMbps: 60, diskGb: 240, gpu: 'A100 ×4', vcpu: 48, memMb: 98304 },
  'M-03011042': { dph: 2.2, bwMbps: 40, diskGb: 240, gpu: 'H200 NVL ×1', vcpu: 20, memMb: 40960 },
  'M-07730119': { dph: 0.72, bwMbps: 80, diskGb: 240, gpu: 'RTX 4090 ×4', vcpu: 32, memMb: 65536 },
  'M-06250011': { dph: 4.11, bwMbps: 100, diskGb: 240, gpu: 'GB300 ×1', vcpu: 64, memMb: 131072 },
  /* 名下已登记、尚未挂牌的机器：上架流程只从这些机器里挑，不凭空造机器 */
  'M-04770132': { dph: 2.36, bwMbps: 60, diskGb: 480, gpu: 'RTX 5090 ×4', vcpu: 32, memMb: 65536 },
  'M-02933310': { dph: 4.4, bwMbps: 40, diskGb: 240, gpu: 'H200 NVL ×2', vcpu: 20, memMb: 40960 },
}

/** 未知机器（真实下单的新机）的演示兜底 */
export const FALLBACK_SPEC: MachineSpec = { dph: 2, bwMbps: 30, diskGb: 240, gpu: '', vcpu: 16, memMb: 32768 }

const machineKey = (label?: string) => (label ?? '').split(' · ')[0] ?? ''

export const specOf = (label?: string): MachineSpec => MACHINE_SPECS[machineKey(label)] ?? FALLBACK_SPEC
