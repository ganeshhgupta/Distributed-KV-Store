# Distributed Key-Value Store Simulator

A production-grade distributed KV store simulator built with Next.js 14, NeonDB, Drizzle ORM, and Tailwind CSS.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Client (Browser)                    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│              Next.js App (API Routes)                │
│   /api/kv  /api/nodes  /api/wal  /api/partition      │
│   /api/replicate  /api/traces                        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           Distributed KV Engine (lib/)               │
│  ┌─────────┐ ┌───────────┐ ┌──────┐ ┌───────────┐  │
│  │ quorum  │ │replication│ │ wal  │ │ partition │  │
│  └────┬────┘ └─────┬─────┘ └──┬───┘ └─────┬─────┘  │
└───────┼────────────┼──────────┼────────────┼────────┘
        │            │          │            │
┌───────▼────────────▼──────────▼────────────▼────────┐
│              NeonDB (Serverless Postgres)             │
│  nodes │ kv_store │ wal_log │ quorum_decisions        │
│  partitions │ traces │ spans                          │
└─────────────────────────────────────────────────────┘

3-Node Cluster:
  ┌──────┐     ┌──────┐
  │  N1  │─────│  N2  │
  │Leader│     │ Fol. │
  └──┬───┘     └──────┘
     │
  ┌──▼───┐
  │  N3  │
  │ Fol. │
  └──────┘
```

## Distributed Systems Concepts

### Quorum (W + R > N)
- **N=3** total nodes
- **W=2** write quorum (majority must ACK writes)
- **R=2** read quorum (read from majority, return highest version)
- Formula: `2 + 2 > 3` ✓ — guarantees strong consistency

### Write-Ahead Log (WAL)
```
Index │ Op     │ Key           │ Value          │ Term │ Replicated
  1   │ PUT    │ user:1001     │ {"name":"Alice"}│  1   │ [n1, n2, n3]
  2   │ PUT    │ config:timeout│ 5000            │  1   │ [n1, n2]
  3   │ DELETE │ session:old   │ null            │  1   │ [n1]
```
- Append-only log: every mutation is recorded before applying
- On node restart: replay WAL from index 0 to rebuild state
- Enables catch-up replication after network partition recovery

### Replication
- Leader receives all writes, increments `log_index`
- Followers pull WAL entries, apply in order
- `replication_lag = leader.log_index - follower.committed_log_index`
- Leader election: promote follower with highest `log_index`

### Partition Tolerance
- Network partitions are simulated by marking node pairs as unreachable
- During partition: writes to isolated nodes fail quorum (only 1 ACK)
- Zero data loss: uncommitted writes are never acknowledged
- On heal: isolated node replays missing WAL entries to catch up

## Local Setup

```bash
git clone <repo>
cd distributed-kv-store
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your NeonDB connection string

# Run migrations and seed
npx tsx src/lib/migrate.ts
npx tsx src/lib/seed.ts

# Start dev server
npm run dev
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kv?key=<key>` | Read a key (R=2 quorum) |
| PUT | `/api/kv` | Write key-value (W=2 quorum) |
| DELETE | `/api/kv` | Delete key (W=2 quorum) |
| GET | `/api/nodes` | List all nodes with stats |
| GET | `/api/nodes/[id]` | Get single node |
| PATCH | `/api/nodes/[id]` | Update node (promote to leader) |
| GET | `/api/wal?node_id=n1` | Get WAL entries for node |
| POST | `/api/wal/replay` | Replay WAL from index |
| GET | `/api/partition` | List all partitions |
| POST | `/api/partition` | Inject or heal partition |
| GET | `/api/replicate` | Get replication lag |
| POST | `/api/replicate` | Trigger manual catch-up |
| GET | `/api/traces` | List recent traces |
| GET | `/api/traces?operation_id=<id>` | Get trace with spans |

## Fault Injection Demo

1. Navigate to `/partitions`
2. Click **Auto Demo** to run the full scenario:
   - Injects N1↔N3 partition
   - Writes 5 keys (quorum met via N1+N2)
   - Heals partition
   - WAL catch-up: N3 replays 5 missing entries
   - Verifies zero data loss

## Deployment (Vercel)

```bash
npx vercel --token=$VERCEL_TOKEN --yes
npx vercel env add NEON_DATABASE_URL production --token=$VERCEL_TOKEN
npx vercel --prod --token=$VERCEL_TOKEN --yes
```
