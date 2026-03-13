'use client'

interface NodeVote {
  acked: boolean
  reason?: string
}

interface QuorumDiagramProps {
  node_votes: Record<string, NodeVote>
  decision: string
  required_acks: number
  received_acks: number
}

export default function QuorumDiagram({ node_votes, decision, required_acks, received_acks }: QuorumDiagramProps) {
  const nodes = ['n1', 'n2', 'n3']
  const isAccepted = decision === 'accept'

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Quorum Decision</div>
      <div className="flex items-center justify-center gap-6 mb-4">
        {nodes.map(nodeId => {
          const vote = node_votes[nodeId]
          const hasVote = vote !== undefined
          const acked = vote?.acked === true
          const bg = !hasVote ? 'bg-border' : acked ? 'bg-success' : 'bg-error'
          const icon = !hasVote ? '?' : acked ? '✓' : '✗'
          return (
            <div key={nodeId} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center text-white font-bold text-sm`}>
                {icon}
              </div>
              <div className="text-text-secondary text-xs">{nodeId.toUpperCase()}</div>
              {vote?.reason && (
                <div className="text-error text-xs">{vote.reason}</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">ACKs: {received_acks}/{required_acks} required</span>
        <span className={`font-bold px-3 py-1 rounded-full text-xs ${isAccepted ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
          {isAccepted ? 'ACCEPTED' : 'REJECTED'}
        </span>
      </div>
    </div>
  )
}
