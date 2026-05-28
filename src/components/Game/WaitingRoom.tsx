import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { setReady, startGame, leaveTable, addBotPlayer, removeBotPlayer } from '../../lib/tables'
import { isBotUid } from '../../lib/bots'
import type { TableMeta, TablePlayer } from '../../types'

interface Props {
  table: TableMeta
  players: Record<string, TablePlayer>
}

const MODE_LABELS = {
  mountain: '⛰️ Munte (8→1→8)',
  valley: '🏔️ Vale (1→8→1)',
}

const MODE_DESC = {
  mountain: 'Începi cu 8 cărți, cobori la 1, urci înapoi la 8',
  valley: 'Începi cu 1 carte, urci la 8, cobori înapoi la 1',
}

export default function WaitingRoom({ table, players }: Props) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const playerList = Object.values(players)
  const humanPlayers = playerList.filter(p => !p.isBot)
  const botPlayers = playerList.filter(p => p.isBot)
  const myPlayer = user ? players[user.uid] : undefined
  const isHost = user?.uid === table.createdBy

  // All non-bot players must be ready; bots are always ready
  const allReady = playerList.length >= 3 && humanPlayers.every(p => p.ready)
  const canStart = isHost && allReady && playerList.length >= 3

  // Find next available bot slot (1..5)
  const usedBotNumbers = botPlayers.map(p => parseInt(p.uid.replace('bot-', ''), 10))
  const nextBotNumber = [1, 2, 3, 4, 5].find(n => !usedBotNumbers.includes(n)) ?? null
  const canAddBot = isHost && nextBotNumber !== null && playerList.length < table.maxPlayers

  const handleReadyToggle = async () => {
    if (!user) return
    await setReady(table.id, user.uid, !myPlayer?.ready)
  }

  const handleStart = async () => {
    await startGame(table.id, playerList, table.gameMode)
  }

  const handleLeave = async () => {
    if (!user) return
    await leaveTable(table.id, user.uid)
    navigate('/')
  }

  const handleAddBot = async () => {
    if (!nextBotNumber) return
    await addBotPlayer(table.id, nextBotNumber)
  }

  const handleRemoveBot = async (botUid: string) => {
    const n = parseInt(botUid.replace('bot-', ''), 10)
    await removeBotPlayer(table.id, n)
  }

  const totalRounds = table.roundSequence.length || (3 * table.maxPlayers + 12)

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        {/* Table info */}
        <div className="waiting-header">
          <h1 className="waiting-title">{table.name}</h1>
          <div className="waiting-meta">
            <span>👥 {playerList.length}/{table.maxPlayers} jucători</span>
            <span title={MODE_DESC[table.gameMode]}>
              {MODE_LABELS[table.gameMode]}
            </span>
            <span>🃏 {totalRounds} runde</span>
            {table.groupId && <span>🏠 Joc de grup</span>}
          </div>
        </div>

        {/* Round preview */}
        <div className="round-preview">
          <span className="round-preview-label">Secvența rundelor:</span>
          <div className="round-sequence">
            {(table.roundSequence.length > 0
              ? table.roundSequence
              : Array.from({ length: totalRounds }, (_, i) => {
                  // Preview before game starts (use maxPlayers as estimate)
                  const seq = buildPreviewSequence(table.gameMode, table.maxPlayers)
                  return seq[i] ?? 0
                })
            ).map((cards, i) => (
              <span
                key={i}
                className={`seq-chip ${cards === 1 ? 'seq-chip--one' : ''} ${cards === 8 ? 'seq-chip--eight' : ''}`}
              >
                {cards}
              </span>
            ))}
          </div>
        </div>

        {/* Players list */}
        <div className="waiting-players">
          {playerList.map(p => (
            <div
              key={p.uid}
              className={`waiting-player ${p.isBot ? 'waiting-player--bot' : ''}`}
            >
              {p.photoURL
                ? <img src={p.photoURL} alt="" className="waiting-avatar" />
                : <div className="waiting-avatar waiting-avatar--bot">🤖</div>
              }
              <div className="waiting-player-info">
                <span className="waiting-player-name">
                  {p.displayName}
                  {p.uid === table.createdBy && <span className="host-badge">host</span>}
                  {p.uid === user?.uid && <span className="me-badge">tu</span>}
                  {p.isBot && <span className="bot-badge">bot</span>}
                </span>
              </div>
              <div className={`ready-indicator ${p.ready ? 'ready-indicator--ready' : ''}`}>
                {p.ready ? '✓ Ready' : 'Neready'}
              </div>
              {/* Host can remove bots */}
              {isHost && p.isBot && (
                <button
                  className="btn-remove-bot"
                  onClick={() => handleRemoveBot(p.uid)}
                  title="Elimină bot"
                >
                  ✕
                </button>
              )}
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
            {isHost && ' — adaugă boți pentru a testa!'}
          </div>
        )}
        {!allReady && playerList.length >= 3 && humanPlayers.some(p => !p.ready) && (
          <div className="waiting-status info">
            ⏳ Se așteaptă ca toți jucătorii umani să fie ready
          </div>
        )}
        {allReady && isHost && (
          <div className="waiting-status success">
            ✅ Toți sunt ready! Poți porni jocul.
          </div>
        )}

        {/* Consecutive bonus info */}
        <div className="bonus-info">
          🏆 <strong>Bonus consecutiv:</strong> +10 pct pentru 5 nimereli exacte la rând
          (exclusiv rundele de 1 carte)
        </div>

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

          {/* Add bot button (host only) */}
          {canAddBot && (
            <button className="btn-bot" onClick={handleAddBot} title="Adaugă jucător bot pentru testare">
              🤖 Adaugă Bot
            </button>
          )}

          {myPlayer && !myPlayer.isBot && (
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

// Build preview sequence before game starts (uses maxPlayers as estimate)
function buildPreviewSequence(mode: TableMeta['gameMode'], n: number): number[] {
  const down = [7, 6, 5, 4, 3, 2]
  const up = [2, 3, 4, 5, 6, 7]
  const eights = Array<number>(n).fill(8)
  const ones = Array<number>(n).fill(1)
  if (mode === 'mountain') return [...eights, ...down, ...ones, ...up, ...eights]
  return [...ones, ...up, ...eights, ...down, ...ones]
}
