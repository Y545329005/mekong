type Props = { name: 'arrow' | 'diagonal' | 'chevron' | 'globe' | 'chip' | 'bolt' | 'calendar' | 'layers' | 'close' | 'menu' | 'check' | 'user' | 'term' | 'trash' | 'refresh' | 'stop' | 'play' | 'port' | 'plus'; size?: number }
export default function Icon({ name, size = 18 }: Props) {
  const paths = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    diagonal: <><path d="M6 18 18 6M6 6h12v12" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    chip: <><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z" />,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 2v6m8-6v6M4 11h16m-11 4h6" /></>,
    layers: <><path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    check: <path d="m5 12 4 4L19 6" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
    term: <><path d="m4 17 6-5-6-5" /><path d="M12 19h8" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 4v5h-5" /></>,
    stop: <><rect x="6.5" y="6.5" width="11" height="11" rx="1" /></>,
    play: <path d="M7 4.5v15l13-7.5z" />,
    port: <><path d="M5 12h14M12 5v14" /><path d="m8.5 8.5-3.5 3.5 3.5 3.5M15.5 8.5 19 12l-3.5 3.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
