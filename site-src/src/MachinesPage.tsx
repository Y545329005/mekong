/* ============================================================================
   THESIS  宿主机器页回答：我上架了哪些机器、每台在哪个地区、当前出租状态如何。
           机器＝供给资产：上架供给市场后被租客租用，出租中＝有活跃租约。
   OWN-WORLD  白底，样式复用资金页（WalletPage.module.css）同一套类。
   STORY  上架 → 进入供给市场 → 租客下单 → 出租中；下架后回归空闲。
          本批为只读快照：种子与资金页演示订单同源（同一批机器编号，见
          hostMachines.ts），上架/下架与编辑操作后续批次接入。
   FORM  汇总卡（机器总数 + 出租中/空闲）→ 演示说明 → 机器列表。
   ========================================================================== */

import type { Language } from './content'
import { regions } from './content'
import type { Account } from './AuthGate'
import { WalletLocked } from './AuthGate'
import { stampFull } from './wallet/store'
import { Badge } from './wallet/ui'
import s from './WalletPage.module.css'
import { HOST_MACHINES } from './hostMachines'
import type { HostMachine } from './hostMachines'

const copy = {
  zh: {
    title: '我的机器',
    lead: '上架到供给市场的机器与当前出租状态。',
    count: '机器',
    list: '机器列表',
    no: '机器编号',
    gpu: 'GPU',
    region: '地区',
    listed: '上架时间',
    status: '状态',
    rented: '出租中',
    idle: '空闲',
    demoLabel: 'DEMO',
    demoNote: '机器状态为演示快照（与资金页演示订单同源）；上架、下架与编辑暂未开放。',
    empty: '还没有上架的机器。',
  },
  en: {
    title: 'Machines',
    lead: 'Machines listed on the supply marketplace and their current rental status.',
    count: 'Machines',
    list: 'Machines',
    no: 'Machine ID',
    gpu: 'GPU',
    region: 'Region',
    listed: 'Listed',
    status: 'Status',
    rented: 'Rented',
    idle: 'Idle',
    demoLabel: 'DEMO',
    demoNote: 'Machine status is a demo snapshot (same machines as the funds-page demo orders); listing, unlisting and editing are not available yet.',
    empty: 'No machines listed yet.',
  },
}

export default function MachinesPage({ lang, account, onSignIn }: {
  lang: Language
  account: Account | null
  onSignIn: (email: string) => void
}) {
  if (!account) return <WalletLocked lang={lang} onSignIn={onSignIn} title={copy[lang].title} />
  return <MachinesAccount key={account.email} lang={lang} />
}

function MachinesAccount({ lang }: { lang: Language }) {
  const t = copy[lang]
  const running = HOST_MACHINES.filter(m => m.status === 'running').length
  const idle = HOST_MACHINES.length - running
  const regionName = (id: HostMachine['region']) => {
    const found = regions.find(item => item.id === id)
    return found ? found[lang === 'zh' ? 'zh' : 'en'] : id.toUpperCase()
  }

  return <div className={s.page}>
    <div className={s.shell}>
      <header className={s.head}>
        <h1>{t.title}</h1>
        <p className={s.lead}>{t.lead}</p>
      </header>

      <section className={s.pools} aria-label={t.count}>
        <article className={s.pool}>
          <header className={s.poolHead}>
            <span className={s.poolMark} aria-hidden="true" />
            <div className={s.poolIdentity}>
              <span className={s.poolVendor}>{t.count}</span>
              <span className={s.poolRole}>{lang === 'zh' ? `出租中 ${running} · 空闲 ${idle}` : `Rented ${running} · Idle ${idle}`}</span>
            </div>
          </header>
          <div className={s.poolFoot}>
            <strong className={s.poolAmount}>{HOST_MACHINES.length}</strong>
          </div>
        </article>
      </section>

      {/* 演示说明统一虚线框形制（与收益页一致），不混入数据区 */}
      <div className={s.demoRow}>
        <span className={s.demoLabel}>{t.demoLabel}</span>
        <span className={s.demoNote}>{t.demoNote}</span>
      </div>

      <section className={s.section} aria-labelledby="machines-list-title">
        <div className={s.sectionHead}>
          <h2 id="machines-list-title">{t.list}</h2>
        </div>
        {HOST_MACHINES.length === 0 ? <p className={s.empty}>{t.empty}</p> : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr>
                <th>{t.no}</th><th>{t.gpu}</th><th>{t.region}</th><th>{t.listed}</th><th>{t.status}</th>
              </tr></thead>
              <tbody>
                {HOST_MACHINES.map(machine => <tr key={machine.id}>
                  <td className={s.machine}>{machine.id}</td>
                  <td className={s.machine}>{machine.gpu}</td>
                  <td>{regionName(machine.region)}</td>
                  <td className={s.machine}>{stampFull(machine.listedAt)}</td>
                  <td><Badge tone={machine.status === 'running' ? 'ok' : 'muted'}>
                    {machine.status === 'running' ? t.rented : t.idle}
                  </Badge></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  </div>
}

