import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resolveTrick, getBiddingOrder } from '../../lib/cards'
import { finalizeTrick } from '../../lib/tables'
import type { TableMeta, RoundState, TablePlayer, PlayerHand } from '../../types'
import BiddingPanel from './BiddingPanel'
import PlayerHand from './PlayerHand'
import TrickArea from './TrickArea'
import ScoreBoard from './ScoreBoard'
import RoundSummary from './RoundSummary'
import CardComponent from './CardComponent'

interface Props {
  table: TableMeta
  round: RoundState
  hand: PlayerHand
  players: Record<string, TablePlayer>
}

export default function GameTable({ table, round, hand, players }: Props) {
  const { user } = useAuth()
  const { playerOrder } = table

  // ── Trick resolution (runs on every client, leader writes) ────────────────
  useEffect(() => {
    if (
      round.phase !== 'playing' ||
      round.currentTrick.length !== playerOrder.length ||
      !user
    ) return

    // Only the trick leader resolves (prevents double-writes)
    if (round.trickLeader !== user.uid) return

    const winner = resolveTrick(round.currentTrick, round.trumpSuit)
    const newTricksWon = {
      ...round.tricksWon,
      [winner]: (round.tricksWon[winner] ?? 0) + 1,
    }
    const totalTricks = Object.values(newTricksWon).reduce((a, b) => a + b, 0)
    const isLastTrick = totalTricks === round.cardsPerPlayer

    finalizeTrick(table.id, table.currentRound, winner, newTricksWon, isLastTrick)
  }, [round.currentTrick.length, round.phase])

  // ── Layout: position other players around the table ───────────────────────
  const myIdx = playerOrder.indexOf(user?.uid ?? '')
  const otherPlayers = playerOrder
    .filter(uid => uid !== user?.uid)
    .map((uid, i) => {
      const relativePos = ((playerOrder.indexOf(uid) - myIdx + playerOrder.length) % playerOrder.length)
      return { uid, relativePos }
    })

  const positionClass = (pos: number, total: number) => {
    // Distribute other players: top-left, top, top-right (for 2-5 opponents)
    const positions = ['top-left', 'top', 'top-right', 'left', 'right']
    if (total <= 3) return positions[pos - 1] || 'top'
    return positions[pos - 1] || 'top'
  }

  return (
    <div className="game-table">
      {/* Other players (face-down cards + info) */}
      {otherPlayers.map(({ uid, relativePos }) => {
        const player = players[uid]
        const bid = round.bids[uid]
        const won = round.tricksWon[uid] ?? 0
        const isCurrentPlayer = round.currentPlayer === uid
        const cardCount = hand.cards.length // approximate (all same round)

        return (
          <div
            key={uid}
            className={`opponent opponent--${positionClass(relativePos, otherPlayers.length)} ${isCurrentPlayer ? 'opponent--active' : ''}`}
          >
            <div className="opponent-info">
              <img src={player?.photoURL ?? ''} alt="" className="opponent-avatar" />
              <div className="opponent-details">
                <span className="opponent-name">{player?.displayName ?? uid}</span>
                <span className="opponent-bid-info">
                  {bid >= 0 ? `${won}/${bid}` : '…'}
                </span>
              </div>
              {isCurrentPlayer && (
                <span className="opponent-turn">🔄</span>
              )}
            </div>
            {/* Face-down cards */}
            <div className="opponent-cards">
              {Array.from({ length: round.cardsPerPlayer - (round.tricksWon[uid] ?? 0) }).map((_, i) => (
                <CardComponent key={i} card={{ suit: 'S', rank: '2', id: 'back' }} faceDown small />
              ))}
            </div>
          </div>
        )
      })}

      {/* Center: trick area */}
      <div className="game-center">
        <TrickArea
          trick={round.currentTrick}
          players={players}
          trumpSuit={round.trumpSuit}
          playerOrder={playerOrder}
          myUid={user?.uid ?? ''}
        />

        {/* Bidding panel overlays center when in bidding phase */}
        {round.phase === 'bidding' && (
          <BiddingPanel table={table} round={round} />
        )}
      </div>

      {/* Scoreboard (side panel) */}
      <div className="game-sidebar">
        <ScoreBoard table={table} round={round} players={players} />
      </div>

      {/* My hand (bottom) */}
      {round.phase !== 'bidding' && (
        <div className="game-bottom">
          <PlayerHand table={table} round={round} hand={hand} />
        </div>
      )}

      {/* Round summary modal */}
      {round.phase === 'scoring' && (
        <RoundSummary table={table} round={round} players={players} />
      )}
    </div>
  )
}
