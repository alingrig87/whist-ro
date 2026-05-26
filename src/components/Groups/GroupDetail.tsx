import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { subscribeToGroupMembers, leaveGroup, refreshInviteCode, deleteGroup } from '../../lib/groups'
import { getRecentGames, winRate } from '../../lib/leaderboard'
import type { GroupMember, GameRecord, Group } from '../../types'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [recentGames, setRecentGames] = useState<GameRecord[]>([])
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    if (!groupId) return
    return onSnapshot(doc(db, 'groups', groupId), snap => {
      if (!snap.exists()) return
      const d = snap.data()
      setGroup({
        id: snap.id,
        name: d.name,
        description: d.description,
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toDate() ?? new Date(),
        inviteCode: d.inviteCode,
        memberUids: d.memberUids ?? [],
      })
    })
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    return subscribeToGroupMembers(groupId, setMembers)
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    getRecentGames(groupId, 10).then(setRecentGames)
  }, [groupId])

  const isAdmin = group?.createdBy === user?.uid

  const handleCopyCode = async () => {
    if (!group) return
    await navigator.clipboard.writeText(group.inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleRefreshCode = async () => {
    if (!groupId) return
    await refreshInviteCode(groupId)
  }

  const handleLeave = async () => {
    if (!groupId || !user) return
    if (!confirm('Ești sigur că vrei să ieși din grup?')) return
    await leaveGroup(groupId, user.uid)
    navigate('/groups')
  }

  const handleDelete = async () => {
    if (!groupId) return
    if (!confirm('Ștergi definitiv grupul? Această acțiune nu poate fi anulată.')) return
    await deleteGroup(groupId)
    navigate('/groups')
  }

  if (!group) {
    return <div className="page-loading"><div className="spinner" /></div>
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/groups')}>← Grupuri</button>
        <h1>👥 {group.name}</h1>
      </header>

      <main className="page-main group-detail">
        {/* Invite code */}
        <div className="invite-code-box">
          <div className="invite-code-label">Cod de invitație:</div>
          <div className="invite-code-value">{group.inviteCode}</div>
          <button className="btn-copy" onClick={handleCopyCode}>
            {codeCopied ? '✓ Copiat!' : '📋 Copiază'}
          </button>
          {isAdmin && (
            <button className="btn-secondary btn--sm" onClick={handleRefreshCode}>
              🔄 Reînnoiește
            </button>
          )}
        </div>

        {/* Leaderboard */}
        <section className="group-section">
          <h2 className="section-title">🏆 Clasament grup</h2>
          <div className="leaderboard-table">
            <div className="lb-row lb-row--header">
              <span>#</span>
              <span>Jucător</span>
              <span>Jocuri</span>
              <span>Victorii</span>
              <span>Scor total</span>
            </div>
            {members.map((m, i) => (
              <div
                key={m.uid}
                className={`lb-row ${m.uid === user?.uid ? 'lb-row--me' : ''}`}
              >
                <span className="lb-rank">{medals[i] || `#${i + 1}`}</span>
                <span className="lb-player">
                  <img src={m.photoURL} alt="" className="lb-avatar" />
                  {m.displayName}
                  {m.uid === user?.uid && <span className="me-tag"> (tu)</span>}
                  {m.role === 'admin' && <span className="admin-tag">admin</span>}
                </span>
                <span>{m.gamesPlayed}</span>
                <span>{m.wins} ({winRate(m.wins, m.gamesPlayed)}%)</span>
                <span className="lb-score">{m.totalScore}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent games */}
        {recentGames.length > 0 && (
          <section className="group-section">
            <h2 className="section-title">🃏 Jocuri recente</h2>
            <div className="recent-games">
              {recentGames.map(game => {
                const winner = game.players.find(p => p.uid === game.winner)
                return (
                  <div key={game.id} className="recent-game-row">
                    <span className="game-date">
                      {game.finishedAt.toLocaleDateString('ro-RO')}
                    </span>
                    <span className="game-winner">
                      🏆 {winner?.displayName ?? '—'}
                    </span>
                    <div className="game-scores">
                      {game.players
                        .sort((a, b) => b.score - a.score)
                        .map(p => (
                          <span
                            key={p.uid}
                            className={`game-score-chip ${p.uid === user?.uid ? 'game-score-chip--me' : ''}`}
                          >
                            {p.displayName}: {p.score}
                          </span>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="group-actions">
          <button className="btn-secondary" onClick={handleLeave}>
            Ieși din grup
          </button>
          {isAdmin && (
            <button className="btn-danger" onClick={handleDelete}>
              Șterge grupul
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
