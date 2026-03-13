'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/nodes', label: 'Nodes', icon: '◉' },
  { href: '/operations', label: 'Operations', icon: '⌘' },
  { href: '/replication', label: 'Replication', icon: '⇌' },
  { href: '/wal', label: 'WAL Viewer', icon: '≡' },
  { href: '/partitions', label: 'Partitions', icon: '✂' },
  { href: '/tracing', label: 'Tracing', icon: '◎' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-sidebar flex flex-col border-r border-border">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-accent font-bold text-lg tracking-tight">KV Cluster</div>
        <div className="text-text-secondary text-xs mt-0.5">Distributed Simulator</div>
      </div>
      <nav className="flex-1 py-3">
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-accent/10 text-accent border-r-2 border-accent font-medium'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-border">
        <div className="text-text-secondary text-xs">W=2 R=2 N=3</div>
        <div className="text-text-secondary text-xs mt-0.5">Quorum: W+R &gt; N ✓</div>
      </div>
    </aside>
  )
}
