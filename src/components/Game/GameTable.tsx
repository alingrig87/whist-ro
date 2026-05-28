import { useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resolveTrick, getBiddingOrder, getNextBidder } from '../../lib/cards'
import { finalizeTrick, submitBid, playCard, transitionToPlaying } from '../../lib/tables'
import { isBotUid, getBotBid, getBotCard, BOT_DELAY_MS } from '../../lib/bots'
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
  allHands: Record<string, PlayerHand>  // all hands, populated for host
}

export default function GameTable({ table, round, hand, players, allHands }: Props) {
  const { user } = useAuth()
  const { playerOrder } = table
  const isHost = user?.uid === table.createdBy

  // Prevent double-writes with a ref
  const resolvingTrick = useRef(false)
  const botActing = useRef(false)

  // ── Trick resolution ────────────────────────────────────────────────────────
  useEffect(() => {
    if (
      round.phase !== 'playing' ||
      round.currentTrick.length !== playerOrder.length ||
      !user ||
      resolvingTrick.current
    ) return

    const trickLeaderIsMe = round.trickLeader === user.uid
    const trickLeaderIsBot = isBotUid(round.trickLeader)

    // Resolve if I'm the trick leader, OR I'm the host and the leader is a bot
    if (!trickLeaderIsMe && !(isHost && trickLeaderIsBot)) return

    resolvingTrick.current = true

    const winner = resolveTrick(round.currentTrick, round.trumpSuit)
    const newTricksWon = {
      ...round.tricksWon,
      [winner]: (round.tricksWon[winner] ?? 0) + 1,
    }
    const totalTricks = Object.values(newTricksWon).reduce((a, b) => a + b, 0)
    const isLastTrick = totalTricks === round.cardsPerPlayer

    finalizeTrick(table.id, table.currentRound, winner, newTricksWon, isLastTrick)
      .finally(() => { resolvingTrick.current = false })

  }, [round.currentTrick.length, round.phase, round.trickLeader])

  // ── Transition bidding → playing once all bids are in ───────────────────────
  useEffect(() => {
    if (round.phase !== 'bidding' || !user) return

    const allBid = playerOrder.every(uid => round.bids[uid] >= 0)
    if (!allBid) return

    // Only the host (or trick leader, whoever fires first) transitions
    if (!isHost) return

    const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
    const firstPlayer = biddingOrder[0]

    transitionToPlaying(table.id, table.currentRound, firstPlayer)
  }, [JSON.stringify(round.bids), round.phase])

  // ── Bot auto-play ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Only the host controls bots
    if (!isHost || !user) return

    const currentIsBot = isBotUid(round.currentPlayer)
    if (!currentIsBot) return

    // Don't act in scoring phase
    if (round.phase === 'scoring') return

    // Need the bot's hand for playing phase
    const botHand = allHands[round.currentPlayer]
    if (round.phase === 'playing' && !botHand) return

    if (botActing.current) return
    botActing.current = true

    const timer = setTimeout(async () => {
      try {
        if (round.phase === 'bidding') {
          const bid = getBotBid(round, playerOrder)
          const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
          const nextPlayer = getNextBidder(round.bids, biddingOrder, round.currentPlayer)
          await submitBid(table.id, table.currentRound, round.currentPlayer, bid, nextPlayer)
        } else if (round.phase === 'playing' && botHand) {
          const cardId = getBotCard(botHand, round)
          await playCard(table.id, table.currentRound, round.currentPlayer, cardId, botHand)
        }
      } finally {
        botActing.current = false
      }
    }, BOT_DELAY_MS)

    return () => {
      clearTimeout(timer)
      botActing.current = false
    }
  }, [round.currentPlayer, round.phase, round.currentTrick.length, allHands[round.currentPlayer]?.cards.length])

  // ── Layout: position other players around the table ──────────────────────────
  const myIdx = playerOrder.indexOf(user?.uid ?? '')
  const otherPlayers = playerOrder
    .filter(uid => uid !== user?.uid)
    .map(uid => {
      const relativePos = (playerOrder.indexOf(uid) - myIdx + playerOrder.length) % playerOrder.length
      return { uid, relativePos }
    })

  const positionClass = (pos: number) => {
    const positions = ['top-left', 'top', 'top-right', 'left', 'right']
    return positions[pos - 1] ?? 'top'
  }

  return (
    <div className="game-table">
      {/* Other players (face-down cards + info) */}
      {otherPlayers.map(({ uid, relativePos }) => {
        const player = players[uid]
        const bid = round.bids[uid]
        const won = round.tricksWon[uid] ?? 0
        const isCurrentPlayer = round.currentPlayer === uid
        const cardsLeft = Math.max(0, round.cardsPerPlayer - won)
        const isBot = isBotUid(uid)

        return (
          <div
            key={uid}
            className={`opponent opponent--${positionClass(relativePos)} ${isCurrentPlayer ? 'opponent--active' : ''} ${isBot ? 'opponent--bot' : ''}`}
          >
            <div className="opponent-info">
              {player?.photoURL
                ? <img src={player.photoURL} alt="" className="opponent-avatar" />
                : <div className={`opponent-avatar opponent-avatar--placeholder ${isBot ? 'opponent-avatar--bot' : ''}`}>
                    {isBot ? '🤖' : '?'}
                  </div>
              }
              <div className="opponent-details">
                <span className="opponent-name">
                  {player?.displayName ?? uid}
                  {isBot && <span className="bot-tag">bot</span>}
                </span>
                <span className="opponent-bid-info">
                  {bid >= 0 ? `${won}/${bid}` : '…'}
                </span>
              </div>
              {isCurrentPlayer && <span className="opponent-turn">🔄</span>}
            </div>
            {/* Face-down cards */}
            <div className="opponent-cards">
              {Array.from({ length: cardsLeft }).map((_, i) => (
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
