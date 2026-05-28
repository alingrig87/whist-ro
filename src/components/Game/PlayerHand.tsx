import { useState, useEffect, useRef } from 'react'
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
  x: number
  y: number
  startX: number
  startY: number
}

export default function PlayerHand({ table, round, hand, duringBidding = false }: Props) {
  const { user } = useAuth()
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [overDropZone, setOverDropZone] = useState(false)

  const isMyTurn = round.currentPlayer === user?.uid && round.phase === 'playing'
  const ledSuit = round.currentTrick.length > 0 ? round.currentTrick[0].card.suit : null
  const legalCards = isMyTurn ? getLegalCards(hand.cards, ledSuit, round.trumpSuit) : []
  const legalIds = new Set(legalCards.map(c => c.id))

  // ── Pointer drag (desktop + mobile) ──────────────────────────────────────
  useEffect(() => {
    if (!dragState) return

    const onMove = (e: PointerEvent) => {
      setDragState(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)

      const zone = document.getElementById('trick-drop-zone')
      if (zone) {
        const r = zone.getBoundingClientRect()
        setOverDropZone(
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom
        )
      }
    }

    const onUp = (e: PointerEvent) => {
      const zone = document.getElementById('trick-drop-zone')
      if (zone) {
        const r = zone.getBoundingClientRect()
        const dropped =
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom
        if (dropped && dragState) {
          const card = hand.cards.find(c => c.id === dragState.cardId)
          if (card && isMyTurn && legalIds.has(card.id)) {
            doPlay(card)
          }
        }
      }
      setDragState(null)
      setOverDropZone(false)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragState, isMyTurn, hand.cards, legalIds])

  const doPlay = async (card: Card) => {
    if (!user || !isMyTurn || !legalIds.has(card.id)) return
    setSelectedCard(null)
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
    setDragState({ cardId: card.id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY })
  }

  const handleClick = (card: Card) => {
    if (!isMyTurn || !legalIds.has(card.id)) return
    // Already selected → play
    if (selectedCard === card.id) {
      doPlay(card)
    } else {
      setSelectedCard(card.id)
    }
  }

  const handleDoubleClick = (card: Card) => {
    if (!isMyTurn || !legalIds.has(card.id)) return
    doPlay(card)
  }

  const isDragging = (cardId: string) =>
    dragState?.cardId === cardId

  const dragMoved = dragState
    ? Math.hypot(dragState.x - dragState.startX, dragState.y - dragState.startY) > 8
    : false

  const turnLabel = duringBidding
    ? '🃏 Cărțile tale — licitează mai sus'
    : isMyTurn
      ? ledSuit
        ? `Trebuie să joci ${SUIT_SYMBOLS[ledSuit]}${round.trumpSuit ? ' sau atu' : ''}`
        : '🃏 Tu deschizi mâna — dublu-click sau trage cartea în centru'
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
            className={`hand-card-wrapper ${duringBidding ? 'hand-card-wrapper--bidding' : ''} ${isDragging(card.id) && dragMoved ? 'hand-card-wrapper--dragging' : ''}`}
            style={{ zIndex: selectedCard === card.id ? 20 : idx }}
            onPointerDown={e => handlePointerDown(e, card)}
            onClick={() => handleClick(card)}
            onDoubleClick={() => handleDoubleClick(card)}
          >
            <CardComponent
              card={card}
              selected={selectedCard === card.id}
              legal={!isMyTurn || legalIds.has(card.id)}
            />
          </div>
        ))}
      </div>

      {/* Drag ghost — follows pointer */}
      {dragState && dragMoved && (() => {
        const card = hand.cards.find(c => c.id === dragState.cardId)
        if (!card) return null
        return (
          <div
            className={`drag-ghost ${overDropZone ? 'drag-ghost--over' : ''}`}
            style={{ left: dragState.x, top: dragState.y }}
            aria-hidden
          >
            <CardComponent card={card} selected legal />
          </div>
        )
      })()}
    </div>
  )
}
