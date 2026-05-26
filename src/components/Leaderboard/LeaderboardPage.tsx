import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { subscribeToTopPlayers, winRate } from '../../lib/leaderboard'
import type { UserProfile } from '../../types'

type SortMode = 'totalScore' | 'totalWins' | 'totalGames'

const SORT_LABELS: Record<SortMode, string> = {
  totalScore: 'Scor total',
  totalWins: 'Victorii',
  totalGames: 'Jocuri jucate',
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<UserProfile[]>([])
  const [sortBy, setSortBy] = useState<SortMode>('totalScore')

  useEffect(() => {
    return subscribeToTopPlayers(setPlayers, sortBy)
  }, [sortBy])

  const medals = ['🥇', '🥈', '🥉']

  // For win rate sort, re-sort client-side
  const sorted =
    sortBy === 'totalWins'
      ? [...players]
          .filter(p => p.totalGames >= 3)
          .sort((a, b) => winRate(b.totalWins, b.totalGames) - winRate(a.totalWins, a.totalGames))
      : players

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Lobby</button>
        <h1>🏆 Clasament Global</h1>
      </header>

      <main className="page-main">
        {/* Sort tabs */}
        <div className="sort-tabs">
          {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
            <button
              key={mode}
              className={`sort-tab ${sortBy === mode ? 'sort-tab--active' : ''}`}
              onClick={() => setSortBy(mode)}
            >
              {SORT_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="leaderboard-table">
          <div className="lb-row lb-row--header">
            <span>#</span>
            <span>Jucător</span>
            <span>Jocuri</span>
            <span>Victorii</span>
            <span>
              {sortBy === 'totalScore' ? 'Scor total' :
               sortBy === 'totalWins' ? '% Victorii' : 'Jocuri'}
            </span>
          </div>

          {sorted.length === 0 && (
            <div className="lb-empty">
              <p>Niciun joc terminat încă. Fii primul!</p>
            </div>
          )}

          {sorted.map((p, i) => {
            const isMe = p.uid === user?.uid
            return (
              <div key={p.uid} className={`lb-row ${isMe ? 'lb-row--me' : ''}`}>
                <span className="lb-rank">
                  {medals[i] || `#${i + 1}`}
                </span>
                <span className="lb-player">
                  <img src={p.photoURL} alt="" className="lb-avatar" />
                  <div className="lb-player-info">
                    <span className="lb-name">
                      {p.displayName}
                      {isMe && <span className="me-tag"> (tu)</span>}
                    </span>
                  </div>
                </span>
                <span>{p.totalGames}</span>
                <span>
                  {p.totalWins}
                  {p.totalGames > 0 && (
                    <span className="lb-pct">
                      ({winRate(p.totalWins, p.totalGames)}%)
                    </span>
                  )}
                </span>
                <span className="lb-score">
                  {sortBy === 'totalScore' && `${p.totalScore} pct`}
                  {sortBy === 'totalWins' && `${winRate(p.totalWins, p.totalGames)}%`}
                  {sortBy === 'totalGames' && p.totalGames}
                </span>
              </div>
            )
          })}
        </div>

        {sortBy === 'totalWins' && (
          <p className="lb-footnote">
            * % victorii — minimum 3 jocuri pentru calificare
          </p>
        )}
      </main>
    </div>
  )
}
