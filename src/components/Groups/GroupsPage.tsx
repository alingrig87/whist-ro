import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { subscribeToMyGroups, joinGroupByCode } from '../../lib/groups'
import type { Group } from '../../types'
import CreateGroupModal from './CreateGroupModal'

export default function GroupsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [groups, setGroups] = useState<Group[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeToMyGroups(user.uid, setGroups)
  }, [user?.uid])

  const handleJoinByCode = async () => {
    if (!profile || !joinCode.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      const groupId = await joinGroupByCode(joinCode.trim(), profile)
      navigate(`/groups/${groupId}`)
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Eroare la alăturare')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Lobby
        </button>
        <h1>👥 Grupurile mele</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Grup nou
        </button>
      </header>

      <main className="page-main">
        {/* Join by code */}
        <div className="join-code-box">
          <h3>Alătură-te unui grup</h3>
          <div className="join-code-input">
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="COD DE INVITAȚIE (ex: KMPW4R)"
              maxLength={6}
              className="form-input code-input"
            />
            <button
              className="btn-primary"
              onClick={handleJoinByCode}
              disabled={joining || joinCode.length !== 6}
            >
              {joining ? '...' : 'Intră'}
            </button>
          </div>
          {joinError && <p className="form-error">{joinError}</p>}
        </div>

        {/* My groups */}
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p>Nu faci parte din niciun grup.</p>
            <p>Creează un grup sau introdu un cod de invitație.</p>
          </div>
        ) : (
          <div className="groups-list">
            {groups.map(group => (
              <div
                key={group.id}
                className="group-card"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <div className="group-card-icon">👥</div>
                <div className="group-card-info">
                  <h3 className="group-card-name">{group.name}</h3>
                  {group.description && (
                    <p className="group-card-desc">{group.description}</p>
                  )}
                  <span className="group-card-members">
                    {group.memberUids.length} membri
                  </span>
                </div>
                {group.createdBy === user?.uid && (
                  <span className="group-admin-badge">admin</span>
                )}
                <span className="group-arrow">→</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && profile && (
        <CreateGroupModal
          profile={profile}
          onClose={() => setShowCreate(false)}
          onCreated={id => navigate(`/groups/${id}`)}
        />
      )}
    </div>
  )
}
