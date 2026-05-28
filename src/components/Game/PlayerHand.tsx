import { useState } from 'react'
import CardComponent from './CardComponent'
import { getLegalCards, SUIT_SYMBOLS } from '../../lib/cards'
import { playCard } from '../../lib/tables'
import type { Card, RoundState, TableMeta, PlayerHand as HandType } from '../../types'
import { useAuth } from '../../context/AuthContext'

interface Props {
  table: TableMeta
  round: RoundState
  hand: HandType
  duringBidding?: boolean
}

export default function PlayerHand({ table, round, hand, duringBidding = false }: Props) {
  const { user } = useAuth()
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  const isMyTurn = round.currentPlayer === user?.uid && round.phase === 'playing'
  const ledSuit = round.currentTrick.length > 0 ? round.currentTrick[0].card.suit : null
  const legalCards = isMyTurn ? getLegalCards(hand.cards, ledSuit, round.trumpSuit) : []
  const legalIds = new Set(legalCards.map(c => c.id))

  const handleCardClick = (card: Card) => {
    if (!isMyTurn || !legalIds.has(card.id)) return
    if (selectedCard === card.id) {
      handlePlayCard(card)
    } else {
      setSelectedCard(card.id)
    }
  }

  const handlePlayCard = async (card: Card) => {
    if (!user) return
    await playCard(table.id, table.currentRound, user.uid, card.id, hand)
    setSelectedCard(null)
  }

  const turnLabel = duringBidding
    ? '🃏 Cărțile tale — licitează mai sus'
    : isMyTurn
      ? ledSuit
        ? `Trebuie să joci ${SUIT_SYMBOLS[ledSuit]} sau atu`
        : '🃏 Tu conduci levata — alege o carte'
      : '⏳ Aștepți rândul tău...'

  return (
    <div className="player-hand-container">
      <div className={`turn-indicator ${isMyTurn ? 'turn-indicator--active' : ''} ${duringBidding ? 'turn-indicator--bidding' : ''}`}>
        {turnLabel}
      </div>

      <div className={`player-hand ${isMyTurn ? 'player-hand--active' : ''}`}>
        {hand.cards.map((card, idx) => (
          <div
            key={card.id}
            className={`hand-card-wrapper ${duringBidding ? 'hand-card-wrapper--bidding' : ''}`}
            style={{ zIndex: idx }}
          >
            <CardComponent
              card={card}
              selected={selectedCard === card.id}
              legal={!isMyTurn || legalIds.has(card.id)}
              onClick={() => handleCardClick(card)}
            />
          </div>
        ))}
      </div>

      {selectedCard && (
        <div className="play-confirm">
          <button
            className="btn-play-confirm"
            onClick={() => {
              const card = hand.cards.find(c => c.id === selectedCard)
              if (card) handlePlayCard(card)
            }}
          >
            ▶ Joacă această carte
          </button>
          <button className="btn-play-cancel" onClick={() => setSelectedCard(null)}>
            Anulează
          </button>
        </div>
      )}
    </div>
  )
}
