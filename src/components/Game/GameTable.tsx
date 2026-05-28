import { useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { resolveTrick, getBiddingOrder, getNextBidder, SUIT_SYMBOLS, SUIT_COLORS } from '../../lib/cards'
import { finalizeTrick, submitBid, playCard, transitionToPlaying } from '../../lib/tables'
import { applyRoundScores } from '../../lib/scoring'
import { isBotUid, getBotBid, getBotCard, BOT_DELAY_MS } from '../../lib/bots'
import type { TableMeta, RoundState, TablePlayer, PlayerHand, Card } from '../../types'
import BiddingPanel from './BiddingPanel'
import PlayerHandComponent from './PlayerHand'
import TrickArea from './TrickArea'
import ScoreBoard from './ScoreBoard'
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
  // Tracks the last action key to prevent double-firing the bot effect
  const lastBotActionKey = useRef('')

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
  // Only the host triggers this, and only once (phase check prevents re-fire)
  const transitioningRef = useRef(false)
  useEffect(() => {
    if (round.phase !== 'bidding' || !user || !isHost) return
    if (transitioningRef.current) return
    const allBid = playerOrder.every(uid => (round.bids[uid] ?? -1) >= 0)
    if (!allBid) return

    transitioningRef.current = true
    const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
    transitionToPlaying(table.id, table.currentRound, biddingOrder[0])
      .finally(() => { transitioningRef.current = false })
  }, [JSON.stringify(round.bids), round.phase])

  // ── Bot auto-play ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || !user) return
    if (!isBotUid(round.currentPlayer)) return
    if (round.phase === 'scoring') return

    // Guard: don't re-bid if bot already bid (prevents loop when last bidder
    // hasn't had currentPlayer updated yet by transitionToPlaying)
    if (round.phase === 'bidding' && (round.bids[round.currentPlayer] ?? -1) >= 0) return

    // Need the bot's hand to play a card
    const botHand = allHands[round.currentPlayer]
    if (round.phase === 'playing' && (!botHand || botHand.cards.length === 0)) return

    // Deduplicate: same round + player + phase + trick = same action, skip
    const actionKey = `${table.currentRound}|${round.currentPlayer}|${round.phase}|${round.currentTrick.length}`
    if (lastBotActionKey.current === actionKey) return
    lastBotActionKey.current = actionKey

    // 1-card rounds are simple — use a shorter delay
    const delay = round.cardsPerPlayer === 1 ? 350 : BOT_DELAY_MS

    const timer = setTimeout(async () => {
      try {
        if (round.phase === 'bidding') {
          const bid = getBotBid(round, playerOrder)
          const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
          const next = getNextBidder(round.bids, biddingOrder, round.currentPlayer)
          await submitBid(table.id, table.currentRound, round.currentPlayer, bid, next)
        } else if (round.phase === 'playing' && botHand && botHand.cards.length > 0) {
          const cardId = getBotCard(botHand, round)
          await playCard(table.id, table.currentRound, round.currentPlayer, cardId, botHand, playerOrder, round.currentTrick.length)
        }
      } catch (e) {
        console.error('Bot action failed:', e)
        lastBotActionKey.current = '' // allow retry on next render
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [
    round.currentPlayer,
    round.phase,
    round.currentTrick.length,
    round.bids[round.currentPlayer],        // re-check when bid state changes
    allHands[round.currentPlayer]?.cards.length,
  ])

  // ── Auto-advance after scoring (host only, 4s delay) ────────────────────
  const scoringRef = useRef(false)
  useEffect(() => {
    if (round.phase !== 'scoring' || !isHost || scoringRef.current) return
    scoringRef.current = true
    const timer = setTimeout(async () => {
      try {
        await applyRoundScores(table, round, players)
      } finally {
        scoringRef.current = false
      }
    }, 4000)
    return () => { clearTimeout(timer); scoringRef.current = false }
  }, [round.phase, table.currentRound])

  // ── Opponent layout ──────────────────────────────────────────────────────
  const myIdx = playerOrder.indexOf(user?.uid ?? '')
  const opponents = playerOrder
    .filter(uid => uid !== user?.uid)
    .map((uid, i) => {
      const relativePos = (playerOrder.indexOf(uid) - myIdx + playerOrder.length) % playerOrder.length
      return { uid, relativePos }
    })

  return (
    <div className="game-table">

      {/* Green felt oval */}
      <div className="table-oval" />

      {/* Trump card — face-up on the table, bottom-right of oval */}
      {round.trumpCard && (
        <div className="trump-card-on-table">
          <span className="trump-card-label">Atu</span>
          <CardComponent card={round.trumpCard} />
        </div>
      )}

      {/* Round badge — prominent, top-center */}
      <div className="round-badge">
        <span className="round-badge-num">Runda {round.roundNumber} / {table.totalRounds}</span>
        <span className="round-badge-cards">{round.cardsPerPlayer} {round.cardsPerPlayer === 1 ? 'carte' : 'cărți'}/jucător</span>
        {round.trumpCard
          ? <TrumpCardBadge card={round.trumpCard} />
          : <span className="round-badge-trump round-badge-trump--none">Fără atu</span>
        }
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

      {/* Center: drop zone + trick + bidding overlay */}
      <div className="game-center">
        {/* Drop zone — cards dragged here are played */}
        <div
          id="trick-drop-zone"
          className={`trick-drop-zone ${round.phase === 'playing' && round.currentPlayer === user?.uid ? 'trick-drop-zone--active' : ''}`}
        >
          <TrickArea
            trick={round.currentTrick}
            players={players}
            trumpSuit={round.trumpSuit}
            playerOrder={playerOrder}
            myUid={user?.uid ?? ''}
          />
        </div>

        {round.phase === 'bidding' && (
          <BiddingPanel table={table} round={round} />
        )}

        {/* Scoring banner — auto-advances after 4s */}
        {round.phase === 'scoring' && (
          <ScoringBanner round={round} players={players} playerOrder={playerOrder} />
        )}
      </div>

      {/* Scoreboard — big persistent leaderboard */}
      <div className="game-sidebar">
        <ScoreBoard table={table} round={round} players={players} />
      </div>

      {/* My hand — always visible at bottom */}
      <div className="game-bottom">
        <PlayerHandComponent
          table={table}
          round={round}
          hand={hand}
          duringBidding={round.phase === 'bidding'}
        />
      </div>
    </div>
  )
}

// Small banner shown during scoring phase; auto-advances after 4s (host only)
function ScoringBanner({
  round,
  players,
  playerOrder,
}: {
  round: RoundState
  players: Record<string, TablePlayer>
  playerOrder: string[]
}) {
  return (
    <div className="scoring-banner">
      <div className="scoring-banner-title">Runda {round.roundNumber} completă!</div>
      <div className="scoring-banner-rows">
        {playerOrder.map(uid => {
          const bid  = round.bids[uid] ?? 0
          const won  = round.tricksWon[uid] ?? 0
          const hit  = bid === won
          const delta = hit ? 5 + bid : -(Math.abs(bid - won))
          return (
            <div key={uid} className={`scoring-banner-row ${hit ? 'scoring-banner-row--hit' : 'scoring-banner-row--miss'}`}>
              <span className="scoring-banner-name">{players[uid]?.displayName ?? uid}</span>
              <span className="scoring-banner-bid">{won}/{bid}</span>
              <span className={`scoring-banner-delta ${hit ? 'delta-pos' : 'delta-neg'}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </div>
          )
        })}
      </div>
      <div className="scoring-banner-hint">Se trece la runda următoare...</div>
    </div>
  )
}

// Small inline trump card shown in the round badge
function TrumpCardBadge({ card }: { card: Card }) {
  const isRed = card.suit === 'H' || card.suit === 'D'
  return (
    <span className="trump-card-badge" style={{ color: SUIT_COLORS[card.suit] }}>
      Atu: <strong>{card.rank}{SUIT_SYMBOLS[card.suit]}</strong>
    </span>
  )
}
