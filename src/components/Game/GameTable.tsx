import { useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resolveTrick, getBiddingOrder, getNextBidder } from '../../lib/cards'
import { finalizeTrick, submitBid, playCard, transitionToPlaying } from '../../lib/tables'
import { isBotUid, getBotBid, getBotCard, BOT_DELAY_MS } from '../../lib/bots'
import type { TableMeta, RoundState, TablePlayer, PlayerHand } from '../../types'
import BiddingPanel from './BiddingPanel'
import PlayerHandComponent from './PlayerHand'
import TrickArea from './TrickArea'
import ScoreBoard from './ScoreBoard'
import RoundSummary from './RoundSummary'
import CardComponent from './CardComponent'

interface Props {
  table: TableMeta
  round: RoundState
  hand: PlayerHand
  players: Record<string, TablePlayer>
  allHands: Record<string, PlayerHand>
}

/**
 * Computes absolute position (left%, top%) for each opponent in a smooth arc
 * across the top half of the screen.
 *
 * pos: 1..total (relative seat index clockwise from me)
 * total: number of opponents
 */
function getOpponentStyle(pos: number, total: number): React.CSSProperties {
  const fraction = pos / (total + 1) // 0..1 from left to right
  const left = 8 + fraction * 84   // 8% → 92%

  // Arc: centre sits higher than edges
  const distFromCentre = Math.abs(fraction - 0.5) * 2  // 0 at centre, 1 at edges
  const top = 4 + distFromCentre * 10                  // 4% (centre) → 14% (edges)

  return { left: `${left}%`, top: `${top}%` }
}

export default function GameTable({ table, round, hand, players, allHands }: Props) {
  const { user } = useAuth()
  const { playerOrder } = table
  const isHost = user?.uid === table.createdBy

  const resolvingTrick = useRef(false)
  const botActing = useRef(false)

  // ── Trick resolution ────────────────────────────────────────────────────
  useEffect(() => {
    if (
      round.phase !== 'playing' ||
      round.currentTrick.length !== playerOrder.length ||
      !user ||
      resolvingTrick.current
    ) return

    const trickLeaderIsMe  = round.trickLeader === user.uid
    const trickLeaderIsBot = isBotUid(round.trickLeader)
    if (!trickLeaderIsMe && !(isHost && trickLeaderIsBot)) return

    resolvingTrick.current = true
    const winner = resolveTrick(round.currentTrick, round.trumpSuit)
    const newTricksWon = { ...round.tricksWon, [winner]: (round.tricksWon[winner] ?? 0) + 1 }
    const totalTricks = Object.values(newTricksWon).reduce((a, b) => a + b, 0)

    finalizeTrick(table.id, table.currentRound, winner, newTricksWon, totalTricks === round.cardsPerPlayer)
      .finally(() => { resolvingTrick.current = false })
  }, [round.currentTrick.length, round.phase, round.trickLeader])

  // ── Bidding → playing transition ────────────────────────────────────────
  useEffect(() => {
    if (round.phase !== 'bidding' || !user || !isHost) return
    const allBid = playerOrder.every(uid => round.bids[uid] >= 0)
    if (!allBid) return

    const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
    transitionToPlaying(table.id, table.currentRound, biddingOrder[0])
  }, [JSON.stringify(round.bids), round.phase])

  // ── Bot auto-play ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || !user) return
    if (!isBotUid(round.currentPlayer)) return
    if (round.phase === 'scoring') return

    const botHand = allHands[round.currentPlayer]
    if (round.phase === 'playing' && !botHand) return
    if (botActing.current) return

    botActing.current = true
    const timer = setTimeout(async () => {
      try {
        if (round.phase === 'bidding') {
          const bid = getBotBid(round, playerOrder)
          const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
          const next = getNextBidder(round.bids, biddingOrder, round.currentPlayer)
          await submitBid(table.id, table.currentRound, round.currentPlayer, bid, next)
        } else if (round.phase === 'playing' && botHand) {
          const cardId = getBotCard(botHand, round)
          await playCard(table.id, table.currentRound, round.currentPlayer, cardId, botHand)
        }
      } finally {
        botActing.current = false
      }
    }, BOT_DELAY_MS)

    return () => { clearTimeout(timer); botActing.current = false }
  }, [round.currentPlayer, round.phase, round.currentTrick.length, allHands[round.currentPlayer]?.cards.length])

  // ── Opponent layout ──────────────────────────────────────────────────────
  const myIdx = playerOrder.indexOf(user?.uid ?? '')
  const opponents = playerOrder
    .filter(uid => uid !== user?.uid)
    .map((uid, i) => {
      const relativePos = (playerOrder.indexOf(uid) - myIdx + playerOrder.length) % playerOrder.length
      return { uid, relativePos }
    })

  const trumpLabel = round.trumpSuit
    ? `Atu: ${{ S: '♠ Pică', H: '♥ Cupă', D: '♦ Caro', C: '♣ Treflă' }[round.trumpSuit]}`
    : 'Fără atu'

  return (
    <div className="game-table">

      {/* Green felt oval */}
      <div className="table-oval" />

      {/* Round badge — prominent, top-center */}
      <div className="round-badge">
        <span className="round-badge-num">Runda {round.roundNumber} / {table.totalRounds}</span>
        <span className="round-badge-cards">{round.cardsPerPlayer} {round.cardsPerPlayer === 1 ? 'carte' : 'cărți'}/jucător</span>
        <span className={`round-badge-trump ${!round.trumpSuit ? 'round-badge-trump--none' : ''}`}>{trumpLabel}</span>
      </div>

      {/* Opponents arranged in arc */}
      {opponents.map(({ uid, relativePos }, i) => {
        const player = players[uid]
        const bid = round.bids[uid]
        const won = round.tricksWon[uid] ?? 0
        const isCurrentPlayer = round.currentPlayer === uid
        const isBot = isBotUid(uid)
        const cardsLeft = Math.max(0, round.cardsPerPlayer - won)

        return (
          <div
            key={uid}
            className={`opponent ${isCurrentPlayer ? 'opponent--active' : ''}`}
            style={getOpponentStyle(relativePos, opponents.length)}
          >
            <div className="opponent-bubble">
              {player?.photoURL
                ? <img src={player.photoURL} alt="" className="opponent-avatar" />
                : <div className={`opponent-avatar--placeholder ${isBot ? 'opponent-avatar--bot' : ''}`}>
                    {isBot ? '🤖' : '👤'}
                  </div>
              }
              <div className="opponent-details">
                <span className="opponent-name">{player?.displayName ?? uid}</span>
                <span className="opponent-bid-info">
                  {bid >= 0 ? `${won}/${bid} mâini` : '…'}
                </span>
              </div>
              {isCurrentPlayer && <span className="opponent-turn">🔄</span>}
            </div>

            {/* Face-down cards */}
            <div className="opponent-cards">
              {Array.from({ length: cardsLeft }).map((_, ci) => (
                <CardComponent
                  key={ci}
                  card={{ suit: 'S', rank: '2', id: 'back' }}
                  faceDown
                  small
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Center: trick + bidding overlay */}
      <div className="game-center">
        <TrickArea
          trick={round.currentTrick}
          players={players}
          trumpSuit={round.trumpSuit}
          playerOrder={playerOrder}
          myUid={user?.uid ?? ''}
        />

        {round.phase === 'bidding' && (
          <BiddingPanel table={table} round={round} />
        )}
      </div>

      {/* Scoreboard */}
      <div className="game-sidebar">
        <ScoreBoard table={table} round={round} players={players} />
      </div>

      {/* My hand — always visible at bottom (greyed out during bidding) */}
      <div className="game-bottom">
        <PlayerHandComponent
          table={table}
          round={round}
          hand={hand}
          duringBidding={round.phase === 'bidding'}
        />
      </div>

      {/* Round summary */}
      {round.phase === 'scoring' && (
        <RoundSummary table={table} round={round} players={players} />
      )}
    </div>
  )
}
