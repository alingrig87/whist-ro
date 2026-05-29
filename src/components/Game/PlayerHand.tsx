import { useState, useEffect } from 'react'
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

interface DragState {
  cardId: string
  startX: number
  startY: number
  x: number
  y: number
}

// How many pixels upward to trigger a play
const PLAY_THRESHOLD = 80

export default function PlayerHand({ table, round, hand, duringBidding = false }: Props) {
  const { user } = useAuth()
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const isMyTurn = round.currentPlayer === user?.uid && round.phase === 'playing'
  const ledSuit = round.currentTrick.length > 0 ? round.currentTrick[0].card.suit : null
  const legalCards = isMyTurn ? getLegalCards(hand.cards, ledSuit, round.trumpSuit) : []
  const legalIds = new Set(legalCards.map(c => c.id))

  // Up-distance during current drag (positive = dragging upward)
  const upDist = drag ? Math.max(0, drag.startY - drag.y) : 0
  const readyToPlay = upDist >= PLAY_THRESHOLD

  // ── Global pointer tracking ───────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      setDrag(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
    }

    const onUp = (e: PointerEvent) => {
      if (drag) {
        const upDistance = drag.startY - e.clientY
        if (upDistance >= PLAY_THRESHOLD) {
          const card = hand.cards.find(c => c.id === drag.cardId)
          if (card && isMyTurn && legalIds.has(card.id)) {
            doPlay(card)
          }
        }
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, isMyTurn, hand.cards, JSON.stringify([...legalIds])])

  const doPlay = async (card: Card) => {
    if (!user || !isMyTurn || !legalIds.has(card.id)) return
    setSelectedCard(null)
    setDrag(null)
    await playCard(
      table.id,
      table.currentRound,
      user.uid,
      card.id,
      hand,
      table.playerOrder,
      round.currentTrick.length,
    )
  }

  const handlePointerDown = (e: React.PointerEvent, card: Card) => {
    if (!isMyTurn || !legalIds.has(card.id)) return
    e.preventDefault()
    setSelectedCard(card.id)
    setDrag({ cardId: card.id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = (card: Card) => {
    if (!isMyTurn || !legalIds.has(card.id)) return
    doPlay(card)
  }

  const isDragging = (id: string) => drag?.cardId === id
  const hasMoved = drag ? Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 6 : false

  const turnLabel = duringBidding
    ? '🃏 Cărțile tale — licitează mai sus'
    : isMyTurn
      ? ledSuit
        ? `Trebuie să joci ${SUIT_SYMBOLS[ledSuit]}${round.trumpSuit ? ' sau atu' : ''}`
        : '🃏 Tu deschizi tura — trage în sus sau dublu-click'
      : '⏳ Aștepți rândul tău...'

  return (
    <div className="player-hand-container">
      <div className={`turn-indicator ${isMyTurn ? 'turn-indicator--active' : ''} ${duringBidding ? 'turn-indicator--bidding' : ''}`}>
        {turnLabel}
      </div>

      {/* Drag progress arc — shows how close to playing */}
      {drag && hasMoved && isMyTurn && (
        <div className="drag-progress">
          <div
            className={`drag-progress-fill ${readyToPlay ? 'drag-progress-fill--ready' : ''}`}
            style={{ width: `${Math.min(100, (upDist / PLAY_THRESHOLD) * 100)}%` }}
          />
          <span className="drag-progress-label">
            {readyToPlay ? '✓ Lasă să joci!' : 'Trage în sus...'}
          </span>
        </div>
      )}

      <div className={`player-hand ${isMyTurn ? 'player-hand--active' : ''}`}>
        {hand.cards.map((card, idx) => (
          <div
            key={card.id}
            className={[
              'hand-card-wrapper',
              duringBidding ? 'hand-card-wrapper--bidding' : '',
              isDragging(card.id) && hasMoved ? 'hand-card-wrapper--dragging' : '',
            ].filter(Boolean).join(' ')}
            style={{ zIndex: selectedCard === card.id ? 20 : idx }}
            onPointerDown={e => handlePointerDown(e, card)}
            onDoubleClick={() => handleDoubleClick(card)}
          >
            <CardComponent
              card={card}
              selected={selectedCard === card.id && !hasMoved}
              legal={!isMyTurn || legalIds.has(card.id)}
            />
          </div>
        ))}
      </div>

      {/* Ghost card — follows pointer during drag */}
      {drag && hasMoved && (() => {
        const card = hand.cards.find(c => c.id === drag.cardId)
        if (!card) return null
        return (
          <div
            className={`drag-ghost ${readyToPlay ? 'drag-ghost--ready' : ''}`}
            style={{ left: drag.x, top: drag.y }}
            aria-hidden
          >
            <CardComponent card={card} selected={readyToPlay} legal />
          </div>
        )
      })()}
    </div>
  )
}
