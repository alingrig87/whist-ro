import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { createTable } from '../../lib/tables'
import type { Group, GameMode } from '../../types'

interface Props {
  myGroups: Group[]
  onClose: () => void
  onCreated: (tableId: string) => void
}

const GAME_MODE_OPTIONS: { value: GameMode; label: string; desc: string; example: string }[] = [
  {
    value: 'mountain',
    label: '⛰️ Munte',
    desc: 'Începi cu 8 cărți, cobori la 1, urci înapoi la 8',
    example: '8,8…→7→6→5→4→3→2→1,1…→2→3→4→5→6→7→8,8…',
  },
  {
    value: 'valley',
    label: '🏔️ Vale',
    desc: 'Începi cu 1 carte, urci la 8, cobori înapoi la 1',
    example: '1,1…→2→3→4→5→6→7→8,8…→7→6→5→4→3→2→1,1…',
  },
]

export default function CreateTableModal({ myGroups, onClose, onCreated }: Props) {
  const { user, profile } = useAuth()
  const [name, setName] = useState(`Masa lui ${profile?.displayName ?? 'jucător'}`)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [gameMode, setGameMode] = useState<GameMode>('valley')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [groupId, setGroupId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalRounds = 3 * maxPlayers + 12

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
        gameMode,
        password || undefined,
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
          {/* Table name */}
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

          {/* Max players */}
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

          {/* Game mode */}
          <div className="form-group">
            <label>Modul de joc</label>
            <div className="game-mode-selector">
              {GAME_MODE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`game-mode-btn ${gameMode === opt.value ? 'game-mode-btn--active' : ''}`}
                  onClick={() => setGameMode(opt.value)}
                >
                  <span className="game-mode-label">{opt.label}</span>
                  <span className="game-mode-desc">{opt.desc}</span>
                  <span className="game-mode-example">{opt.example}</span>
                </button>
              ))}
            </div>
            <p className="form-hint">
              🃏 {totalRounds} runde totale pentru {maxPlayers} jucători
              {' '} • Nivelele de 8 și 1 se joacă de {maxPlayers}× (câte unul per dealer)
            </p>
          </div>

          {/* Password (optional) */}
          <div className="form-group">
            <label htmlFor="table-pw">Parolă masă (opțional)</label>
            <div className="pw-input-row">
              <input
                id="table-pw"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Lasă gol pentru masă publică"
                className="form-input"
                maxLength={32}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            <p className="form-hint">
              {password
                ? '🔒 Masă privată — doar cei cu parola pot intra'
                : '🌐 Masă publică — oricine o poate vedea și intra'}
            </p>
          </div>

          {/* Group */}
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
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="form-hint">Jocurile de grup apar în clasamentul grupului</p>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          {/* Rules summary */}
          <div className="game-info-box">
            <h4>📋 Regulile jocului</h4>
            <ul>
              <li>Nivelele de 8 și 1 se joacă de <strong>{maxPlayers}×</strong> (un dealer diferit fiecare)</li>
              <li>Nivelele 2–7 se joacă câte o singură dată</li>
              <li>Nimerești licitația: <strong>+5 + levate</strong></li>
              <li>Ratezi: <strong>−(diferența absolută)</strong></li>
              <li>Ultimul jucător nu poate face suma = total levate</li>
              <li>🏆 <strong>Bonus +10</strong> pentru 5 nimereli consecutive (non-1)</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Anulează</button>
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
