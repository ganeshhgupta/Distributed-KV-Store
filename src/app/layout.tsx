import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Distributed KV Store Simulator',
  description: 'Production-grade distributed key-value store with quorum, WAL, replication, and partition simulation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-primary text-white min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
