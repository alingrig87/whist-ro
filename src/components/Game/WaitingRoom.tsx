import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { setReady, startGame, leaveTable } from '../../lib/tables'
import type { TableMeta, TablePlayer } from '../../types'

interface Props {
  table: TableMeta
  players: Record<string, TablePlayer>
}

export default function WaitingRoom({ table, players }: Props) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const playerList = Object.values(players)
  const myPlayer = user ? players[user.uid] : undefined
  const isHost = user?.uid === table.createdBy
  const allReady = playerList.length >= 3 && playerList.every(p => p.ready)
  const canStart = isHost && allReady && playerList.length >= 3

  const handleReadyToggle = async () => {
    if (!user) return
    await setReady(table.id, user.uid, !myPlayer?.ready)
  }

  const handleStart = async () => {
    await startGame(table.id, playerList)
  }

  const handleLeave = async () => {
    if (!user) return
    await leaveTable(table.id, user.uid)
    navigate('/')
  }

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        {/* Table info */}
        <div className="waiting-header">
          <h1 className="waiting-title">{table.name}</h1>
          <div className="waiting-meta">
            <span>👥 {playerList.length}/{table.maxPlayers} jucători</span>
            <span>🃏 15 runde</span>
            {table.groupId && <span>🏠 Joc de grup</span>}
          </div>
        </div>

        {/* Players list */}
        <div className="waiting-players">
          {playerList.map(p => (
            <div key={p.uid} className="waiting-player">
              <img src={p.photoURL} alt="" className="waiting-avatar" />
              <div className="waiting-player-info">
                <span className="waiting-player-name">
                  {p.displayName}
                  {p.uid === table.createdBy && <span className="host-badge">host</span>}
                  {p.uid === user?.uid && <span className="me-badge">tu</span>}
                </span>
              </div>
              <div className={`ready-indicator ${p.ready ? 'ready-indicator--ready' : ''}`}>
                {p.ready ? '✓ Ready' : 'Neready'}
              </div>
            </div>
          ))}

          {/* Empty seats */}
          {Array.from({ length: table.maxPlayers - playerList.length }).map((_, i) => (
            <div key={`empty-${i}`} className="waiting-player waiting-player--empty">
              <div className="waiting-avatar-empty">?</div>
              <span className="waiting-player-name">Se așteaptă jucător...</span>
            </div>
          ))}
        </div>

        {/* Status message */}
        {!allReady && playerList.length < 3 && (
          <div className="waiting-status warning">
            ⏳ Se așteaptă cel puțin {3 - playerList.length} jucător(i) în plus
          </div>
        )}
        {!allReady && playerList.length >= 3 && (
          <div className="waiting-status info">
            ⏳ Se așteaptă ca toți jucătorii să fie ready
          </div>
        )}
        {allReady && isHost && (
          <div className="waiting-status success">
            ✅ Toți sunt ready! Poți porni jocul.
          </div>
        )}

        {/* Share link */}
        <div className="waiting-share">
          <span className="share-label">Link invitație:</span>
          <code className="share-link">
            {window.location.origin}/table/{table.id}
          </code>
          <button
            className="btn-copy"
            onClick={() =>
              navigator.clipboard.writeText(`${window.location.origin}/table/${table.id}`)
            }
          >
            📋 Copiază
          </button>
        </div>

        {/* Actions */}
        <div className="waiting-actions">
          <button className="btn-secondary" onClick={handleLeave}>
            Ieșire
          </button>

          {myPlayer && (
            <button
              className={`btn-ready ${myPlayer.ready ? 'btn-ready--active' : ''}`}
              onClick={handleReadyToggle}
            >
              {myPlayer.ready ? '✓ Ready' : 'Sunt ready'}
            </button>
          )}

          {isHost && (
            <button
              className="btn-primary btn-start"
              onClick={handleStart}
              disabled={!canStart}
              title={!canStart ? 'Toți jucătorii trebuie să fie ready (min. 3)' : ''}
            >
              ▶ Pornește jocul
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
