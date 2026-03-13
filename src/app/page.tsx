'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/* ── animated SVG cluster ── */
function ClusterDiagram() {
  /* node centers */
  const N1 = { x: 220, y: 80  }   // leader  – top-center
  const N2 = { x: 80,  y: 290 }   // follower – bottom-left
  const N3 = { x: 360, y: 290 }   // follower – bottom-right

  /* packet state: one per link, cycling 0→1 */
  const [p12, setP12] = useState(0)
  const [p13, setP13] = useState(0.33)
  const [p23, setP23] = useState(0.66)

  useEffect(() => {
    let raf: number
    let last = performance.now()
    const SPEED = 0.0004

    function tick(now: number) {
      const dt = now - last
      last = now
      setP12(v => (v + SPEED * dt) % 1)
      setP13(v => (v + SPEED * dt * 0.85) % 1)
      setP23(v => (v + SPEED * dt * 0.7) % 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function lerp(a: typeof N1, b: typeof N1, t: number) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  const pk12 = lerp(N1, N2, p12)
  const pk13 = lerp(N1, N3, p13)
  const pk23 = lerp(N2, N3, p23)
  const pk21 = lerp(N2, N1, (p12 + 0.5) % 1)

  const linkStyle = {
    stroke: '#37475A',
    strokeWidth: 1.5,
    strokeDasharray: '8 5',
  }

  return (
    <svg viewBox="0 0 440 380" className="w-full max-w-sm mx-auto drop-shadow-2xl select-none">
      {/* defs: glow filters */}
      <defs>
        <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF9900" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#131921" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* background glow */}
      <ellipse cx="220" cy="190" rx="200" ry="170" fill="url(#bg-glow)" />

      {/* ── links ── */}
      <line x1={N1.x} y1={N1.y} x2={N2.x} y2={N2.y} {...linkStyle} />
      <line x1={N1.x} y1={N1.y} x2={N3.x} y2={N3.y} {...linkStyle} />
      <line x1={N2.x} y1={N2.y} x2={N3.x} y2={N3.y} {...linkStyle} />

      {/* ── moving packets ── */}
      {/* N1 → N2 */}
      <circle cx={pk12.x} cy={pk12.y} r={4} fill="#FF9900" opacity={0.9} filter="url(#glow-amber)" />
      {/* N1 → N3 */}
      <circle cx={pk13.x} cy={pk13.y} r={4} fill="#FF9900" opacity={0.9} filter="url(#glow-amber)" />
      {/* N2 → N3 */}
      <circle cx={pk23.x} cy={pk23.y} r={3.5} fill="#067D62" opacity={0.85} filter="url(#glow-green)" />
      {/* N2 → N1 ACK */}
      <circle cx={pk21.x} cy={pk21.y} r={3} fill="#63b3ed" opacity={0.75} />

      {/* ── nodes ── */}
      {/* N1 – Leader */}
      <g>
        <circle cx={N1.x} cy={N1.y} r={44} fill="#131921" stroke="#FF9900" strokeWidth={2} opacity={0.9} />
        <circle cx={N1.x} cy={N1.y} r={44} fill="none" stroke="#FF9900" strokeWidth={1} opacity={0.3}>
          <animate attributeName="r" values="44;58;44" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <text x={N1.x} y={N1.y - 8} textAnchor="middle" fill="#FF9900" fontSize="15" fontWeight="700" fontFamily="monospace">N1</text>
        <text x={N1.x} y={N1.y + 10} textAnchor="middle" fill="#FF9900" fontSize="9" fontWeight="500" letterSpacing="1">LEADER</text>
        <circle cx={N1.x + 26} cy={N1.y - 26} r={6} fill="#067D62">
          <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* N2 – Follower */}
      <g>
        <circle cx={N2.x} cy={N2.y} r={36} fill="#131921" stroke="#067D62" strokeWidth={1.8} opacity={0.9} />
        <circle cx={N2.x} cy={N2.y} r={36} fill="none" stroke="#067D62" strokeWidth={1} opacity={0.25}>
          <animate attributeName="r" values="36;48;36" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="3s" repeatCount="indefinite" />
        </circle>
        <text x={N2.x} y={N2.y - 6} textAnchor="middle" fill="#067D62" fontSize="13" fontWeight="700" fontFamily="monospace">N2</text>
        <text x={N2.x} y={N2.y + 10} textAnchor="middle" fill="#067D62" fontSize="8" letterSpacing="0.5">FOLLOWER</text>
      </g>

      {/* N3 – Follower */}
      <g>
        <circle cx={N3.x} cy={N3.y} r={36} fill="#131921" stroke="#067D62" strokeWidth={1.8} opacity={0.9} />
        <circle cx={N3.x} cy={N3.y} r={36} fill="none" stroke="#067D62" strokeWidth={1} opacity={0.25}>
          <animate attributeName="r" values="36;48;36" dur="3.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="3.4s" repeatCount="indefinite" />
        </circle>
        <text x={N3.x} y={N3.y - 6} textAnchor="middle" fill="#067D62" fontSize="13" fontWeight="700" fontFamily="monospace">N3</text>
        <text x={N3.x} y={N3.y + 10} textAnchor="middle" fill="#067D62" fontSize="8" letterSpacing="0.5">FOLLOWER</text>
      </g>

      {/* labels */}
      <text x="150" y="202" textAnchor="middle" fill="#37475A" fontSize="9" fontFamily="monospace">replicate</text>
      <text x="295" y="202" textAnchor="middle" fill="#37475A" fontSize="9" fontFamily="monospace">replicate</text>
      <text x="220" y="354" textAnchor="middle" fill="#37475A" fontSize="9" fontFamily="monospace">sync</text>
    </svg>
  )
}

/* ── feature pill ── */
function Pill({ icon, label, delay }: { icon: string; label: string; delay: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        bg-white/5 border border-border text-text-secondary
        animate-fade-in-up opacity-0`}
      style={{ animationDelay: delay, animationFillMode: 'forwards' }}
    >
      <span>{icon}</span>{label}
    </span>
  )
}

/* ── stat counter ── */
function Stat({ value, label, delay }: { value: string; label: string; delay: string }) {
  return (
    <div
      className="animate-fade-in-up opacity-0 text-center"
      style={{ animationDelay: delay, animationFillMode: 'forwards' }}
    >
      <div className="gradient-text text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-text-secondary text-xs mt-0.5">{label}</div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [exiting, setExiting] = useState(false)

  function handleEnter() {
    setExiting(true)
    setTimeout(() => router.push('/dashboard'), 550)
  }

  return (
    <div
      className={`min-h-screen bg-primary relative overflow-hidden flex flex-col
        ${exiting ? 'animate-fade-out' : ''}`}
    >
      {/* ── subtle grid bg ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,153,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,153,0,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── ambient blobs ── */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,153,0,0.07) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,125,98,0.07) 0%, transparent 70%)' }} />

      {/* ── nav bar ── */}
      <nav className="relative z-10 flex items-center justify-between px-10 py-5 animate-fade-in opacity-0"
        style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-sm font-bold">⬡</div>
          <span className="text-white font-semibold tracking-tight">KV Cluster</span>
          <span className="text-text-secondary text-xs px-2 py-0.5 rounded-full border border-border ml-1">v1.0</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-text-secondary">
          <span className="hidden md:block">W=2 · R=2 · N=3</span>
          <span className="hidden md:block text-success text-xs">● 3 nodes healthy</span>
          <button
            onClick={handleEnter}
            className="text-accent border border-accent/40 rounded-full px-4 py-1.5 text-sm hover:bg-accent/10 transition-colors"
          >
            Open Cluster →
          </button>
        </div>
      </nav>

      {/* ── main content ── */}
      <div className="relative z-10 flex-1 flex items-center max-w-7xl mx-auto w-full px-10 py-8 gap-12">

        {/* left: text */}
        <div className="flex-1 max-w-xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-medium mb-6 animate-fade-in-up opacity-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />
            DISTRIBUTED SYSTEMS SIMULATOR
          </div>

          <h1
            className="text-5xl font-bold leading-tight mb-2 animate-fade-in-up opacity-0"
            style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}
          >
            <span className="text-white">Distributed</span>
          </h1>
          <h1
            className="text-5xl font-bold leading-tight mb-4 animate-fade-in-up opacity-0"
            style={{ animationDelay: '450ms', animationFillMode: 'forwards' }}
          >
            <span className="gradient-text">KV Store</span>
            <span className="text-white"> Cluster</span>
          </h1>

          <p
            className="text-text-secondary text-lg leading-relaxed mb-8 animate-fade-in-up opacity-0"
            style={{ animationDelay: '550ms', animationFillMode: 'forwards' }}
          >
            A production-grade simulator of a 3-node consensus cluster — quorum writes, WAL-based recovery,
            leader/follower replication, network partition injection, and end-to-end distributed tracing. All
            backed by a real Postgres database.
          </p>

          {/* feature pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            <Pill icon="⚖" label="Quorum Consensus (W+R>N)" delay="650ms" />
            <Pill icon="📋" label="Write-Ahead Log" delay="720ms" />
            <Pill icon="⇌" label="Leader/Follower Replication" delay="790ms" />
            <Pill icon="✂" label="Partition Simulation" delay="860ms" />
            <Pill icon="◎" label="Distributed Tracing" delay="930ms" />
            <Pill icon="↺" label="WAL Replay" delay="1000ms" />
          </div>

          {/* CTA */}
          <div
            className="flex items-center gap-4 animate-fade-in-up opacity-0"
            style={{ animationDelay: '1050ms', animationFillMode: 'forwards' }}
          >
            <button
              onClick={handleEnter}
              className="group relative overflow-hidden px-8 py-3.5 rounded-xl font-bold text-primary text-base
                bg-accent hover:bg-accent/90 transition-all duration-300
                animate-glow-pulse"
            >
              <span className="relative z-10 flex items-center gap-2">
                Launch Dashboard
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </span>
            </button>
            <span className="text-text-secondary text-sm">No setup required</span>
          </div>
        </div>

        {/* right: animated cluster */}
        <div
          className="flex-1 flex flex-col items-center gap-6 animate-fade-in-right opacity-0"
          style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
        >
          <ClusterDiagram />

          {/* quorum formula */}
          <div
            className="border border-border bg-surface rounded-xl px-6 py-4 w-full max-w-sm animate-fade-in-up opacity-0"
            style={{ animationDelay: '900ms', animationFillMode: 'forwards' }}
          >
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Quorum Formula</div>
            <div className="font-mono text-center">
              <span className="text-accent text-xl font-bold">W</span>
              <span className="text-white text-xl mx-1">+</span>
              <span className="text-accent text-xl font-bold">R</span>
              <span className="text-white text-xl mx-1">&gt;</span>
              <span className="text-white text-xl font-bold">N</span>
              <span className="text-text-secondary text-lg mx-2">→</span>
              <span className="text-success text-xl font-bold">2 + 2 &gt; 3</span>
              <span className="text-success ml-2">✓</span>
            </div>
            <div className="flex justify-between mt-3 text-xs text-text-secondary">
              <span>W=2 writes</span><span>R=2 reads</span><span>N=3 nodes</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── bottom stats bar ── */}
      <div
        className="relative z-10 border-t border-border bg-sidebar/40 backdrop-blur-sm px-10 py-5
          animate-fade-in opacity-0"
        style={{ animationDelay: '1100ms', animationFillMode: 'forwards' }}
      >
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <Stat value="3"    label="Cluster Nodes"        delay="1150ms" />
          <Stat value="W=2"  label="Write Quorum"         delay="1220ms" />
          <Stat value="WAL"  label="Crash-Safe Writes"    delay="1290ms" />
          <Stat value="P→A"  label="Partition Tolerance"  delay="1360ms" />
        </div>
      </div>
    </div>
  )
}
