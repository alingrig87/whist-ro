import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { subscribeToOpenTables, subscribeToMyActiveTables, closeTable, joinTable } from '../../lib/tables'
import { subscribeToMyGroups } from '../../lib/groups'
import type { TableMeta, Group } from '../../types'
import CreateTableModal from './CreateTableModal'
import TableCard from './TableCard'

export default function LobbyPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [tables, setTables] = useState<TableMeta[]>([])
  const [myTables, setMyTables] = useState<TableMeta[]>([])
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pwPrompt, setPwPrompt] = useState<{ tableId: string; tableName: string } | null>(null)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToOpenTables(setTables)
    return unsub
  }, [])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToMyGroups(user.uid, setMyGroups)
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToMyActiveTables(user.uid, setMyTables)
    return unsub
  }, [user])

  const doJoin = async (tableId: string, password?: string) => {
    if (!user || !profile) return
    setJoiningId(tableId)
    try {
      await joinTable(tableId, {
        uid: user.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      }, password)
      navigate(`/table/${tableId}`)
    } catch (e) {
      throw e
    } finally {
      setJoiningId(null)
    }
  }

  const handleJoin = async (table: TableMeta) => {
    if (!user || !profile) return
    setError(null)

    if (table.passwordHash) {
      // Show password prompt
      setPwPrompt({ tableId: table.id, tableName: table.name })
      setPwInput('')
      setPwError(null)
      return
    }

    try {
      await doJoin(table.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la alăturare')
    }
  }

  const handlePwJoin = async () => {
    if (!pwPrompt) return
    setPwError(null)
    try {
      await doJoin(pwPrompt.tableId, pwInput)
      setPwPrompt(null)
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Eroare')
    }
  }

  const handleCreated = (tableId: string) => {
    navigate(`/table/${tableId}`)
  }

  const handleClose = async (tableId: string) => {
    if (!confirm('Închizi această masă? Jucătorii vor fi eliminați.')) return
    setClosingId(tableId)
    try {
      await closeTable(tableId)
    } finally {
      setClosingId(null)
    }
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
        {/* My active tables */}
        {myTables.length > 0 && (
          <section className="my-tables-section">
            <h2 className="lobby-section-title">📋 Mesele mele active</h2>
            <div className="my-tables-list">
              {myTables.map(t => (
                <div key={t.id} className="my-table-row">
                  <div className="my-table-info">
                    <span className="my-table-name">
                      {t.passwordHash && '🔒 '}{t.name}
                    </span>
                    <span className={`my-table-status my-table-status--${t.status}`}>
                      {t.status === 'waiting' ? '⏳ Așteptare' : '🎮 În joc'}
                    </span>
                  </div>
                  <div className="my-table-actions">
                    <button
                      className="btn-secondary btn--sm"
                      onClick={() => navigate(`/table/${t.id}`)}
                    >
                      Intră
                    </button>
                    <button
                      className="btn-danger btn--sm"
                      onClick={() => handleClose(t.id)}
                      disabled={closingId === t.id}
                    >
                      {closingId === t.id ? '...' : 'Închide'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                onJoin={() => handleJoin(table)}
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

      {/* Password prompt modal */}
      {pwPrompt && (
        <div className="modal-overlay" onClick={() => setPwPrompt(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔒 {pwPrompt.tableName}</h2>
              <button className="modal-close" onClick={() => setPwPrompt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Parola mesei</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Introdu parola..."
                  value={pwInput}
                  onChange={e => setPwInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePwJoin()}
                  autoFocus
                />
              </div>
              {pwError && <div className="form-error">{pwError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPwPrompt(null)}>Anulează</button>
              <button
                className="btn-primary"
                onClick={handlePwJoin}
                disabled={!pwInput || joiningId === pwPrompt.tableId}
              >
                {joiningId === pwPrompt.tableId ? 'Se verifică...' : 'Intră la masă'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
