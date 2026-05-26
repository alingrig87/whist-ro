import { useState } from 'react'
import { createGroup } from '../../lib/groups'
import type { UserProfile } from '../../types'

interface Props {
  profile: UserProfile
  onClose: () => void
  onCreated: (groupId: string) => void
}

export default function CreateGroupModal({ profile, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Introduceți un nume pentru grup')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const id = await createGroup(name.trim(), description.trim(), profile)
      onCreated(id)
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
          <h2>Crează grup nou</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="group-name">Numele grupului</label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Familia Grigorescu"
              maxLength={50}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-desc">Descriere (opțional)</label>
            <input
              id="group-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ex: Jucăm în fiecare vineri seara"
              maxLength={100}
              className="form-input"
            />
          </div>

          <div className="info-box">
            <p>
              📋 După creare vei primi un cod de invitație din 6 caractere pe care
              îl poți share cu prietenii.
            </p>
          </div>

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Anulează
          </button>
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Se creează...' : 'Crează grupul'}
          </button>
        </div>
      </div>
    </div>
  )
}
