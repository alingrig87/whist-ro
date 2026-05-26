import { useEffect, useState } from 'react'
import { subscribeToPlayers } from '../../lib/tables'
import type { TableMeta, TablePlayer } from '../../types'

interface Props {
  table: TableMeta
  myUid: string
  joining: boolean
  onJoin: () => void
  onOpen: () => void
}

export default function TableCard({ table, myUid, joining, onJoin, onOpen }: Props) {
  const [players, setPlayers] = useState<Record<string, TablePlayer>>({})

  useEffect(() => {
    const unsub = subscribeToPlayers(table.id, setPlayers)
    return unsub
  }, [table.id])

  const playerList = Object.values(players)
  const isMember = myUid in players
  const isFull = playerList.length >= table.maxPlayers

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h3 className="table-name">{table.name}</h3>
        <span className="table-count">
          {playerList.length}/{table.maxPlayers}
        </span>
      </div>

      {/* Player avatars */}
      <div className="table-players">
        {playerList.map(p => (
          <div
            key={p.uid}
            className={`player-pip ${p.uid === myUid ? 'player-pip--me' : ''}`}
            title={p.displayName}
          >
            <img src={p.photoURL} alt={p.displayName} className="pip-avatar" />
            {p.ready && <span className="pip-ready">✓</span>}
          </div>
        ))}
        {/* Empty slots */}
        {Array.from({ length: table.maxPlayers - playerList.length }).map((_, i) => (
          <div key={`empty-${i}`} className="player-pip player-pip--empty">
            <span>?</span>
          </div>
        ))}
      </div>

      {table.groupId && (
        <div className="table-group-badge">👥 Joc de grup</div>
      )}

      <div className="table-card-footer">
        {isMember ? (
          <button className="btn-primary btn--sm" onClick={onOpen}>
            Intră la masă
          </button>
        ) : isFull ? (
          <button className="btn-secondary btn--sm" disabled>
            Masă plină
          </button>
        ) : (
          <button
            className="btn-primary btn--sm"
            onClick={onJoin}
            disabled={joining}
          >
            {joining ? '...' : 'Alătură-te'}
          </button>
        )}
      </div>
    </div>
  )
}
