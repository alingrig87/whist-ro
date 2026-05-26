import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { subscribeToOpenTables, joinTable } from '../../lib/tables'
import { subscribeToMyGroups } from '../../lib/groups'
import type { TableMeta, Group } from '../../types'
import CreateTableModal from './CreateTableModal'
import TableCard from './TableCard'

export default function LobbyPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [tables, setTables] = useState<TableMeta[]>([])
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToOpenTables(setTables)
    return unsub
  }, [])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToMyGroups(user.uid, setMyGroups)
    return unsub
  }, [user])

  const handleJoin = async (tableId: string) => {
    if (!user || !profile) return
    setJoiningId(tableId)
    setError(null)
    try {
      await joinTable(tableId, {
        uid: user.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      })
      navigate(`/table/${tableId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la alăturare')
    } finally {
      setJoiningId(null)
    }
  }

  const handleCreated = (tableId: string) => {
    navigate(`/table/${tableId}`)
  }

  return (
    <div className="page lobby-page">
      {/* Header */}
      <header className="lobby-header">
        <div className="lobby-logo">🃏 Whist RO</div>
        <nav className="lobby-nav">
          <button className="nav-btn" onClick={() => navigate('/leaderboard')}>
            🏆 Clasament
          </button>
          <button className="nav-btn" onClick={() => navigate('/groups')}>
            👥 Grupuri
          </button>
          <button className="nav-btn" onClick={() => navigate('/profile')}>
            <img src={profile?.photoURL} alt="" className="nav-avatar" />
            {profile?.displayName}
          </button>
          <button className="nav-btn nav-btn--secondary" onClick={signOut}>
            Ieșire
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main className="lobby-main">
        <div className="lobby-top">
          <h2 className="lobby-section-title">Mese disponibile</h2>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Crează masă
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {tables.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🃏</div>
            <p>Nu există mese deschise momentan.</p>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              Creează prima masă
            </button>
          </div>
        ) : (
          <div className="tables-grid">
            {tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                myUid={user?.uid ?? ''}
                joining={joiningId === table.id}
                onJoin={() => handleJoin(table.id)}
                onOpen={() => navigate(`/table/${table.id}`)}
              />
            ))}
          </div>
        )}

        {/* Quick group links */}
        {myGroups.length > 0 && (
          <section className="lobby-groups">
            <h3 className="lobby-section-title">Grupurile mele</h3>
            <div className="groups-chips">
              {myGroups.map(g => (
                <button
                  key={g.id}
                  className="group-chip"
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  👥 {g.name}
                  <span className="chip-count">{g.memberUids.length}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {showCreate && (
        <CreateTableModal
          myGroups={myGroups}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
