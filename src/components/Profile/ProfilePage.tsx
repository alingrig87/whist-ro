import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRecentGames, winRate } from '../../lib/leaderboard'
import type { GameRecord } from '../../types'

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<GameRecord[]>([])

  useEffect(() => {
    if (!user) return
    getRecentGames(undefined, 20).then(allGames => {
      // Filter to games where this user participated
      const myGames = allGames.filter(g =>
        g.players.some(p => p.uid === user.uid),
      )
      setGames(myGames)
    })
  }, [user?.uid])

  if (!profile) return <div className="page-loading"><div className="spinner" /></div>

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Lobby</button>
        <h1>Profilul meu</h1>
      </header>

      <main className="page-main">
        {/* Profile card */}
        <div className="profile-card">
          <img src={profile.photoURL} alt="" className="profile-avatar" />
          <div className="profile-info">
            <h2 className="profile-name">{profile.displayName}</h2>
            <p className="profile-email">{profile.email}</p>
            <p className="profile-since">
              Jucător din {profile.createdAt.toLocaleDateString('ro-RO')}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{profile.totalGames}</span>
            <span className="stat-label">Jocuri</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{profile.totalWins}</span>
            <span className="stat-label">Victorii</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {winRate(profile.totalWins, profile.totalGames)}%
            </span>
            <span className="stat-label">% Victorii</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{profile.totalScore}</span>
            <span className="stat-label">Scor total</span>
          </div>
        </div>

        {/* Game history */}
        <section className="profile-section">
          <h2 className="section-title">🃏 Jocuri recente</h2>

          {games.length === 0 ? (
            <p className="empty-text">Niciun joc finalizat încă.</p>
          ) : (
            <div className="game-history">
              {games.map(game => {
                const myResult = game.players.find(p => p.uid === user?.uid)
                const won = game.winner === user?.uid

                return (
                  <div key={game.id} className={`history-row ${won ? 'history-row--win' : ''}`}>
                    <span className="history-date">
                      {game.finishedAt.toLocaleDateString('ro-RO')}
                    </span>
                    <span className="history-result">
                      {won ? '🥇 Victorie' : `#${myResult?.rank ?? '?'}`}
                    </span>
                    <span className="history-score">
                      {myResult?.score ?? 0} pct
                    </span>
                    <div className="history-players">
                      {game.players
                        .sort((a, b) => b.score - a.score)
                        .map((p, i) => (
                          <span
                            key={p.uid}
                            className={`history-player-chip ${p.uid === user?.uid ? 'history-player-chip--me' : ''}`}
                          >
                            {medals[i] || ''} {p.displayName}: {p.score}
                          </span>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="profile-actions">
          <button className="btn-secondary" onClick={signOut}>
            Deconectare
          </button>
        </div>
      </main>
    </div>
  )
}
