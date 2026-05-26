import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { createTable } from '../../lib/tables'
import type { Group } from '../../types'

interface Props {
  myGroups: Group[]
  onClose: () => void
  onCreated: (tableId: string) => void
}

export default function CreateTableModal({ myGroups, onClose, onCreated }: Props) {
  const { user, profile } = useAuth()
  const [name, setName] = useState(`Masa lui ${profile?.displayName ?? 'jucător'}`)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user || !profile) return
    if (!name.trim()) {
      setError('Introduceți un nume pentru masă')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const tableId = await createTable(
        name.trim(),
        maxPlayers,
        { uid: user.uid, displayName: profile.displayName, photoURL: profile.photoURL },
        groupId || undefined,
      )
      onCreated(tableId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la creare')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Crează masă nouă</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="table-name">Numele mesei</label>
            <input
              id="table-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Număr maxim de jucători</label>
            <div className="player-count-selector">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  className={`count-btn ${maxPlayers === n ? 'count-btn--active' : ''}`}
                  onClick={() => setMaxPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="form-hint">Minim 3 jucători pentru a porni jocul</p>
          </div>

          {myGroups.length > 0 && (
            <div className="form-group">
              <label htmlFor="group-select">Grup (opțional)</label>
              <select
                id="group-select"
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="form-select"
              >
                <option value="">Fără grup (joc public)</option>
                {myGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Jocurile de grup apar în clasamentul grupului
              </p>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="game-info-box">
            <h4>📋 Regulile jocului</h4>
            <ul>
              <li>15 runde: 8→7→6→5→4→3→2→1→2→3→4→5→6→7→8 cărți</li>
              <li>Nimerești licitația: +5 + numărul de levate</li>
              <li>Ratezi: -(diferența absolută)</li>
              <li>Ultimul jucător nu poate face suma egală cu totalul</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Anulează
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Se creează...' : 'Crează masa'}
          </button>
        </div>
      </div>
    </div>
  )
}
