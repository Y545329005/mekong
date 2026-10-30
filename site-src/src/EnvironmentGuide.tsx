import { useId, useState } from 'react'
import type { Language } from './content'
import { homeCopy } from './homeContent'
import type { ModalState } from './types'
import styles from './EnvironmentGuide.module.css'

export function environmentGuide(lang: Language): Extract<ModalState, { type: 'guide' }> {
  const t = homeCopy[lang].environment
  return {
    type: 'guide',
    title: lang === 'zh' ? '选择工作环境' : 'Choose an environment',
    description: t.description,
    points: t.items.map(item => `${item.software.join(' / ')} · ${item.name}：${item.description}`),
  }
}

export default function ResourceEnvironment({ lang, gpuId }: { lang: Language; gpuId: string }) {
  const t = homeCopy[lang].environment, id = useId()
  const [selected, setSelected] = useState(gpuId === 'rtx4090' ? 2 : gpuId === 'a100' ? 1 : 0)
  const item = t.items[selected]
  return <section className={styles.environment} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{lang === 'zh' ? '选择工作环境' : 'Choose an environment'}</h3>
    <label htmlFor={`${id}-choice`}>{lang === 'zh' ? '任务类型' : 'Workload'}</label>
    <select id={`${id}-choice`} value={selected} onChange={event => setSelected(Number(event.target.value))}>{t.items.map((option, index) => <option value={index} key={option.workload}>{option.name}</option>)}</select>
    <div className={styles.software}>{item.software.map(software => <span key={software}>{software}</span>)}</div>
    <p>{item.description}</p>
    <details key={selected}><summary>{t.guide}</summary><ul>{item.points.map(point => <li key={point}>{point}</li>)}</ul></details>
  </section>
}
