import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRanks } from '../../lib/scoring'
import type { TableMeta, TablePlayer } from '../../types'

interface Props {
  table: TableMeta
  players: Record<string, TablePlayer>
}

export default function GameSummary({ table, players }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { playerOrder, scores } = table
  const ranks = getRanks(scores, playerOrder)

  const sorted = [...playerOrder].sort((a, b) => scores[b] - scores[a])
  const winner = sorted[0]
  const myRank = user ? ranks[user.uid] : null

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="game-summary-page">
      <div className="game-summary">
        <h1 className="summary-title">🏆 Joc finalizat!</h1>

        {/* Winner highlight */}
        <div className="winner-banner">
          <img
            src={players[winner]?.photoURL ?? ''}
            alt=""
            className="winner-avatar"
          />
          <div className="winner-info">
            <span className="winner-label">Câștigătorul jocului</span>
            <span className="winner-name">
              {winner === user?.uid ? '🎉 Tu!' : players[winner]?.displayName ?? '—'}
            </span>
            <span className="winner-score">{scores[winner]} puncte</span>
          </div>
        </div>

        {/* Full results */}
        <div className="final-results">
          {sorted.map((uid, i) => {
            const player = players[uid]
            const score = scores[uid]
            const isMe = uid === user?.uid

            return (
              <div
                key={uid}
                className={`final-row ${isMe ? 'final-row--me' : ''}`}
              >
                <span className="final-rank">
                  {medals[i] || `#${i + 1}`}
                </span>
                <img src={player?.photoURL ?? ''} alt="" className="final-avatar" />
                <span className="final-name">
                  {player?.displayName ?? uid}
                  {isMe && <span className="me-tag"> (tu)</span>}
                </span>
                <span className="final-score">{score} pct</span>
              </div>
            )
          })}
        </div>

        {/* My result */}
        {myRank && (
          <div className="my-result">
            {myRank === 1 ? (
              <p>🎉 Felicitări! Ai câștigat jocul!</p>
            ) : (
              <p>Ai terminat pe locul {myRank}. Joacă din nou pentru a te îmbunătăți!</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="summary-actions">
          <button className="btn-primary" onClick={() => navigate('/')}>
            🃏 Joacă din nou
          </button>
          <button className="btn-secondary" onClick={() => navigate('/leaderboard')}>
            🏆 Vezi clasament
          </button>
          {table.groupId && (
            <button
              className="btn-secondary"
              onClick={() => navigate(`/groups/${table.groupId}`)}
            >
              👥 Clasament grup
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
