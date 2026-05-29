/**
 * Bot player logic — smart, rule-perfect play.
 *
 * Strategy:
 * - Bidding: counts sure/probable winners (aces, kings, high trumps)
 * - Playing: tracks tricks needed vs. remaining, wins only when necessary,
 *   beats current winner with minimum card, dumps lowest when not needed
 */

import { getForbiddenBid, getBiddingOrder, getLegalCards, RANK_VALUES } from './cards'
import type { RoundState, PlayerHand, Suit, Card } from '../types'

// ─── Bot Identifiers ──────────────────────────────────────────────────────────

export const BOT_UIDS = ['bot-1', 'bot-2', 'bot-3', 'bot-4', 'bot-5'] as const

export const BOT_CONFIGS: Record<string, { name: string; photoURL: string }> = {
  'bot-1': { name: 'Pimp',    photoURL: '/pimp.png' },
  'bot-2': { name: 'Madalin', photoURL: '/madalin.png' },
  'bot-3': { name: 'Tochi',   photoURL: '/tochy.png' },
  'bot-4': { name: '🤖 Bot 4', photoURL: '' },
  'bot-5': { name: '🤖 Bot 5', photoURL: '' },
}

export const BOT_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(BOT_CONFIGS).map(([uid, cfg]) => [uid, cfg.name])
)

export const BOT_DELAY_MS = 900

export function isBotUid(uid: string): boolean {
  return uid.startsWith('bot-')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortByValue(cards: Card[], desc = false): Card[] {
  return [...cards].sort((a, b) =>
    desc
      ? RANK_VALUES[b.rank] - RANK_VALUES[a.rank]
      : RANK_VALUES[a.rank] - RANK_VALUES[b.rank]
  )
}

/** Returns the uid of the player currently winning the trick */
function trickWinnerUid(trick: RoundState['currentTrick'], trumpSuit: Suit | null): string | null {
  if (trick.length === 0) return null
  const ledSuit = trick[0].card.suit
  let winner = trick[0]
  for (const played of trick.slice(1)) {
    const c = played.card
    const w = winner.card
    const cTrump = trumpSuit !== null && c.suit === trumpSuit
    const wTrump = trumpSuit !== null && w.suit === trumpSuit
    if (cTrump && !wTrump) { winner = played; continue }
    if (!cTrump && wTrump) continue
    if (c.suit !== w.suit) continue
    if (c.suit !== ledSuit && !cTrump) continue
    if (RANK_VALUES[c.rank] > RANK_VALUES[w.rank]) winner = played
  }
  return winner.uid
}

/** True if `challenger` beats `current` given led suit and trump */
function beats(challenger: Card, current: Card, ledSuit: Suit, trumpSuit: Suit | null): boolean {
  const cT = trumpSuit !== null && challenger.suit === trumpSuit
  const wT = trumpSuit !== null && current.suit === trumpSuit
  if (cT && !wT) return true
  if (!cT && wT) return false
  if (challenger.suit !== current.suit) return false
  return RANK_VALUES[challenger.rank] > RANK_VALUES[current.rank]
}

// ─── Smart Bidding ────────────────────────────────────────────────────────────

/**
 * Estimates expected tricks based on hand strength:
 * - Aces, kings, queens contribute sure/probable tricks
 * - Trump cards are weighted higher
 * - Forbidden bid is avoided; adjacent value chosen instead
 */
export function getBotBid(round: RoundState, playerOrder: string[]): number {
  // For random-quality fallback (safety)
  const forbid = (() => {
    const bo = getBiddingOrder(playerOrder, round.dealer)
    return getForbiddenBid(round.bids, bo, round.cardsPerPlayer)
  })()

  // Only 1 card → bid 0 or 1 based on card strength
  if (round.cardsPerPlayer === 1) {
    // Will be computed via smartBid below, but clamp to 0/1
  }

  // --- Count expected tricks ---
  const hand = round.currentTrick // not available here; we receive hand separately
  // getBotBid doesn't receive hand directly; see getBotBidFromHand below
  // This overload is kept for compatibility; delegates to random if no hand
  let bid = Math.floor(Math.random() * (round.cardsPerPlayer + 1))
  if (bid === forbid) bid = bid > 0 ? bid - 1 : Math.min(bid + 1, round.cardsPerPlayer)
  return bid
}

/**
 * Full smart bidding — call this when hand is available.
 */
export function getSmartBid(
  hand: PlayerHand,
  round: RoundState,
  playerOrder: string[],
): number {
  const { trumpSuit, cardsPerPlayer } = round
  const cards = hand.cards
  if (cards.length === 0) return 0

  let expected = 0
  const bySuit: Partial<Record<Suit, Card[]>> = {}
  for (const c of cards) {
    if (!bySuit[c.suit]) bySuit[c.suit] = []
    bySuit[c.suit]!.push(c)
  }

  for (const [suit, suitCards] of Object.entries(bySuit) as [Suit, Card[]][]) {
    const sorted = sortByValue(suitCards, true) // highest first
    const isTrump = suit === trumpSuit

    sorted.forEach((card, idx) => {
      const v = RANK_VALUES[card.rank]
      if (isTrump) {
        // Trump cards win a lot
        if (card.rank === 'A')       expected += 0.95
        else if (card.rank === 'K')  expected += 0.85
        else if (card.rank === 'Q')  expected += 0.70
        else if (card.rank === 'J')  expected += 0.55
        else if (v >= 9)             expected += 0.38
        else                         expected += 0.18
      } else {
        // Non-trump: top cards sometimes get trumped
        if (card.rank === 'A')                       expected += 0.82
        else if (card.rank === 'K' && idx === 0)     expected += 0.62
        else if (card.rank === 'K')                  expected += 0.38
        else if (card.rank === 'Q' && idx <= 1)      expected += 0.35
        else if (v >= 10 && idx === 0)               expected += 0.22
      }
    })
  }

  let bid = Math.round(expected)
  bid = Math.max(0, Math.min(cardsPerPlayer, bid))

  // Avoid forbidden bid
  const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
  const forbidden = getForbiddenBid(round.bids, biddingOrder, cardsPerPlayer)
  if (bid === forbidden) {
    // Try adjacent values
    if (bid + 1 <= cardsPerPlayer) bid += 1
    else if (bid - 1 >= 0) bid -= 1
  }

  return bid
}

// ─── Smart Card Play ──────────────────────────────────────────────────────────

/**
 * Chooses the optimal card to play:
 * - Tracks remaining tricks needed (bid - won)
 * - If need to win: plays lowest card that beats current winner
 * - If need to lose: dumps lowest safe card
 * - If leading: leads highest card of strongest suit when winning, lowest when losing
 */
export function getSmartCard(hand: PlayerHand, round: RoundState, myUid: string): string {
  const { trumpSuit, currentTrick, bids, tricksWon, cardsPerPlayer } = round
  const cards = hand.cards
  if (cards.length === 0) return cards[0]?.id ?? ''

  const bid    = bids[myUid] ?? 0
  const won    = tricksWon[myUid] ?? 0
  const needed = bid - won                       // tricks I still need to win
  const left   = cards.length                    // tricks remaining this round

  const ledSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null
  const legal   = getLegalCards(cards, ledSuit, trumpSuit)
  if (legal.length === 1) return legal[0].id

  const low  = sortByValue(legal, false)   // ascending (lowest first)
  const high = sortByValue(legal, true)    // descending (highest first)

  const wantWin = needed > 0
  const mustWinAll = needed >= left        // must win every remaining trick

  // ── Leading the trick ────────────────────────────────────────────────────
  if (ledSuit === null) {
    if (!wantWin) {
      // Dump lowest non-trump if possible
      const nonTrump = low.filter(c => c.suit !== trumpSuit)
      return (nonTrump[0] ?? low[0]).id
    }

    // Lead strongest card to win
    // Prefer leading aces, then high trumps, then high non-trumps
    const aces = high.filter(c => c.rank === 'A')
    if (aces.length > 0) return aces[0].id

    const trumpCards = high.filter(c => c.suit === trumpSuit)
    if (trumpCards.length > 0 && mustWinAll) return trumpCards[0].id

    return high[0].id
  }

  // ── Following a trick ────────────────────────────────────────────────────
  const currentWinnerUid = trickWinnerUid(currentTrick, trumpSuit)
  const winningCard      = currentTrick.find(tc => tc.uid === currentWinnerUid)?.card

  if (!wantWin) {
    // Dump lowest card (prefer non-trump, avoid wasting aces)
    const nonTrump = low.filter(c => c.suit !== trumpSuit)
    if (nonTrump.length > 0) return nonTrump[0].id
    return low[0].id
  }

  // Try to beat current winner with the minimum winning card
  if (winningCard) {
    const canWin = legal.filter(c => beats(c, winningCard, ledSuit, trumpSuit))
    if (canWin.length > 0) {
      // Play lowest winning card
      return sortByValue(canWin, false)[0].id
    }
  }

  // Can't beat — dump lowest
  return low[0].id
}

// ─── Public API (used by GameTable) ──────────────────────────────────────────

export function getBotCard(hand: PlayerHand, round: RoundState, myUid?: string): string {
  if (myUid) return getSmartCard(hand, round, myUid)
  // Fallback: random legal card
  const ledSuit = round.currentTrick.length > 0 ? round.currentTrick[0].card.suit : null
  const legal = getLegalCards(hand.cards, ledSuit, round.trumpSuit)
  return legal[Math.floor(Math.random() * legal.length)]?.id ?? hand.cards[0]?.id ?? ''
}
