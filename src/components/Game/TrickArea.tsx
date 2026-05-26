import CardComponent from './CardComponent'
import type { TrickCard, TablePlayer, Suit } from '../../types'
import { SUIT_SYMBOLS, SUIT_NAMES_RO, SUIT_COLORS } from '../../lib/cards'

interface Props {
  trick: TrickCard[]
  players: Record<string, TablePlayer>
  trumpSuit: Suit | null
  playerOrder: string[]
  myUid: string
}

export default function TrickArea({ trick, players, trumpSuit, playerOrder, myUid }: Props) {
  const myIdx = playerOrder.indexOf(myUid)

  return (
    <div className="trick-area">
      {/* Trump indicator */}
      <div className="trump-indicator">
        {trumpSuit ? (
          <span style={{ color: SUIT_COLORS[trumpSuit] }}>
            Atu: {SUIT_SYMBOLS[trumpSuit]} {SUIT_NAMES_RO[trumpSuit]}
          </span>
        ) : (
          <span className="no-trump">Fără atu</span>
        )}
      </div>

      {/* Cards played in current trick */}
      <div className="trick-cards">
        {trick.map(({ uid, card }) => {
          const player = players[uid]
          const relPos = ((playerOrder.indexOf(uid) - myIdx + playerOrder.length) % playerOrder.length)
          return (
            <div
              key={uid}
              className={`trick-card-slot trick-card-slot--pos${relPos}`}
            >
              <CardComponent card={card} small />
              <span className="trick-card-label">
                {uid === myUid ? 'Tu' : player?.displayName ?? '—'}
              </span>
            </div>
          )
        })}

        {trick.length === 0 && (
          <div className="trick-empty">
            <span>Levata curentă</span>
          </div>
        )}
      </div>
    </div>
  )
}
