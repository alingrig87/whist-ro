import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRecentGames, winRate } from '../../lib/leaderboard'
import { CREDITS_PER_GAME } from '../../types'
import type { GameRecord } from '../../types'
import CreditsModal from '../CreditsModal'

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState<GameRecord[]>([])
  const [showCredits, setShowCredits] = useState(false)

  useEffect(() => {
    if (!user) return
    getRecentGames(undefined, 30).then(all => {
      setGames(all.filter(g => g.players.some(p => p.uid === user.uid)))
    })
  }, [user?.uid])

  if (!profile) return <div className="page-loading"><div className="spinner" /></div>

  const medals = ['🥇', '🥈', '🥉', '4.', '5.', '6.']

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

        {/* Credits */}
        <div className="profile-credits" onClick={() => setShowCredits(true)}>
          <span className="profile-credits-icon">🪙</span>
          <span className="profile-credits-val">{profile.credits ?? 0}</span>
          <span className="profile-credits-label">credite disponibile</span>
          <span className="profile-credits-cost">· {CREDITS_PER_GAME} / joc</span>
          <span className="profile-credits-cta">Cumpără →</span>
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
            <span className="stat-label">Rată victorie</span>
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
            <div className="profile-games">
              {games.map(game => {
                const myResult = game.players.find(p => p.uid === user?.uid)
                const won = typeof game.winner === 'string' && game.winner === user?.uid
                const myRank = typeof myResult?.rank === 'number' ? myResult.rank : null
                const sorted = [...game.players].sort((a, b) =>
                  (b.score ?? 0) - (a.score ?? 0)
                )
                const date = game.finishedAt.toLocaleDateString('ro-RO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })

                return (
                  <div key={game.id} className={`profile-game-card ${won ? 'profile-game-card--win' : ''}`}>
                    {/* Top row */}
                    <div className="pgc-header">
                      <span className="pgc-date">{date}</span>
                      <span className={`pgc-result ${won ? 'pgc-result--win' : ''}`}>
                        {won ? '🥇 Victorie' : myRank ? `Locul ${myRank}` : '—'}
                      </span>
                      <span className="pgc-my-score">
                        {myResult?.score ?? 0} pct
                      </span>
                      <span className="pgc-rounds">{game.totalRounds} runde</span>
                    </div>

                    {/* Player scores */}
                    <div className="pgc-players">
                      {sorted.map((p, i) => (
                        <div
                          key={p.uid}
                          className={`pgc-player ${p.uid === user?.uid ? 'pgc-player--me' : ''}`}
                        >
                          <span className="pgc-medal">{medals[i] ?? ''}</span>
                          {p.photoURL
                            ? <img src={p.photoURL} alt="" className="pgc-avatar" />
                            : <div className="pgc-avatar pgc-avatar--placeholder">👤</div>
                          }
                          <span className="pgc-name">{p.displayName}</span>
                          <span className="pgc-score">{p.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="profile-actions">
          <button className="btn-secondary" onClick={signOut}>Deconectare</button>
        </div>
      </main>

      {showCredits && (
        <CreditsModal credits={profile.credits ?? 0} onClose={() => setShowCredits(false)} />
      )}
    </div>
  )
}
