import { CREDITS_PER_GAME } from '../types'

interface Props {
  credits: number
  onClose: () => void
}

const PACKAGES = [
  { credits: 50,   price: '1€',  label: 'Starter',   popular: false },
  { credits: 200,  price: '3€',  label: 'Popular',   popular: true  },
  { credits: 600,  price: '8€',  label: 'Pro',       popular: false },
]

export default function CreditsModal({ credits, onClose }: Props) {
  const needMore = credits < CREDITS_PER_GAME

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal credits-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🪙 Credite</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Current balance */}
          <div className="credits-balance">
            <span className="credits-balance-label">Soldul tău</span>
            <span className={`credits-balance-value ${needMore ? 'credits-balance--low' : ''}`}>
              🪙 {credits} credite
            </span>
          </div>

          {needMore && (
            <div className="credits-warning">
              ⚠️ Ai nevoie de minimum {CREDITS_PER_GAME} credite pentru a porni un joc.
            </div>
          )}

          <p className="credits-info">
            Fiecare joc costă <strong>{CREDITS_PER_GAME} credite</strong>.
            Creditele nu expiră niciodată.
          </p>

          {/* Packages */}
          <div className="credits-packages">
            {PACKAGES.map(pkg => (
              <div key={pkg.credits} className={`credits-pkg ${pkg.popular ? 'credits-pkg--popular' : ''}`}>
                {pkg.popular && <span className="credits-pkg-badge">Cel mai ales</span>}
                <span className="credits-pkg-label">{pkg.label}</span>
                <span className="credits-pkg-amount">🪙 {pkg.credits}</span>
                <span className="credits-pkg-games">{pkg.credits / CREDITS_PER_GAME} jocuri</span>
                <button
                  className="btn-primary credits-pkg-btn"
                  onClick={() => alert('Plată prin card — în curând! 🚧')}
                >
                  {pkg.price}
                </button>
              </div>
            ))}
          </div>

          <p className="credits-footer">
            🔒 Plată securizată prin Stripe. Procesare în câteva secunde.
          </p>
        </div>
      </div>
    </div>
  )
}
