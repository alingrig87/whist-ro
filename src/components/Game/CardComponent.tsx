import { SUIT_SYMBOLS, SUIT_COLORS } from '../../lib/cards'
import type { Card } from '../../types'

interface Props {
  card: Card
  selected?: boolean
  legal?: boolean
  onClick?: () => void
  faceDown?: boolean
  small?: boolean
}

export default function CardComponent({ card, selected, legal = true, onClick, faceDown, small }: Props) {
  if (faceDown) {
    return (
      <div className={`card card--back ${small ? 'card--small' : ''}`}>
        <div className="card-back-pattern" />
      </div>
    )
  }

  const symbol = SUIT_SYMBOLS[card.suit]
  const color = SUIT_COLORS[card.suit]
  const isRed = card.suit === 'H' || card.suit === 'D'

  return (
    <div
      className={[
        'card',
        selected ? 'card--selected' : '',
        !legal ? 'card--illegal' : '',
        onClick ? 'card--clickable' : '',
        small ? 'card--small' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--card-color': color } as React.CSSProperties}
      onClick={legal ? onClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (onClick && legal && (e.key === 'Enter' || e.key === ' ')) onClick()
      }}
    >
      <div className={`card-rank top ${isRed ? 'card-red' : ''}`}>
        {card.rank}
      </div>
      <div className={`card-suit-center ${isRed ? 'card-red' : ''}`}>
        {symbol}
      </div>
      <div className={`card-rank bottom ${isRed ? 'card-red' : ''}`}>
        {card.rank}
      </div>
    </div>
  )
}
