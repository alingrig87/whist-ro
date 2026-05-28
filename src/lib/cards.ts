import type { Card, Rank, Suit, TrickCard, GameMode } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUITS: Suit[] = ['S', 'H', 'D', 'C']
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠', H: '♥', D: '♦', C: '♣',
}

export const SUIT_NAMES_RO: Record<Suit, string> = {
  S: 'Pică', H: 'Cupă', D: 'Caro', C: 'Treflă',
}

export const SUIT_COLORS: Record<Suit, string> = {
  S: '#1a1a2e', H: '#c0392b', D: '#c0392b', C: '#1a1a2e',
}

// ─── Deck Generation ──────────────────────────────────────────────────────────

export function generateDeck(): Card[] {
  return SUITS.flatMap(suit =>
    RANKS.map(rank => ({ suit, rank, id: `${rank}${suit}` })),
  )
}

// ─── Seeded PRNG: Mulberry32 ──────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Round Structure ──────────────────────────────────────────────────────────

/**
 * Returns the cards-per-player sequence for the whole game.
 *
 * Mountain (Munte) — starts/ends with 8, valley of 1s in centre:
 *   [8×N, 7, 6, 5, 4, 3, 2, 1×N, 2, 3, 4, 5, 6, 7, 8×N]
 *   Example N=4: [8,8,8,8, 7,6,5,4,3,2, 1,1,1,1, 2,3,4,5,6,7, 8,8,8,8]
 *
 * Valley (Vale) — starts/ends with 1, peak of 8s in centre:
 *   [1×N, 2, 3, 4, 5, 6, 7, 8×N, 7, 6, 5, 4, 3, 2, 1×N]
 *   Example N=4: [1,1,1,1, 2,3,4,5,6,7, 8,8,8,8, 7,6,5,4,3,2, 1,1,1,1]
 *
 * Total rounds = 3N + 12 for both modes.
 */
export function getRoundSequence(mode: GameMode, playerCount: number): number[] {
  const N = playerCount
  const down = [7, 6, 5, 4, 3, 2]        // 7→2 (6 rounds)
  const up = [2, 3, 4, 5, 6, 7]           // 2→7 (6 rounds)
  const manyEight = Array<number>(N).fill(8)
  const manyOne = Array<number>(N).fill(1)

  if (mode === 'mountain') {
    // 8,8…(N), 7,6,5,4,3,2, 1,1…(N), 2,3,4,5,6,7, 8,8…(N)
    return [...manyEight, ...down, ...manyOne, ...up, ...manyEight]
  } else {
    // 1,1…(N), 2,3,4,5,6,7, 8,8…(N), 7,6,5,4,3,2, 1,1…(N)
    return [...manyOne, ...up, ...manyEight, ...down, ...manyOne]
  }
}

/** Total rounds = 3N + 12 (same for both modes) */
export function getTotalRounds(playerCount: number): number {
  return 3 * playerCount + 12
}

// ─── Dealing ─────────────────────────────────────────────────────────────────

export function dealCards(
  deck: Card[],
  playerOrder: string[],
  cardsPerPlayer: number,
): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {}
  playerOrder.forEach(uid => (hands[uid] = []))

  // Round-robin dealing (one card at a time to each player)
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let p = 0; p < playerOrder.length; p++) {
      const cardIdx = round * playerOrder.length + p
      const card = deck[cardIdx]
      if (card) hands[playerOrder[p]].push(card)
    }
  }
  return hands
}

export function getTrumpCard(
  deck: Card[],
  playerCount: number,
  cardsPerPlayer: number,
): Card | null {
  if (cardsPerPlayer === 1) return null // No trump in 1-card round
  const trumpIdx = playerCount * cardsPerPlayer
  return deck[trumpIdx] ?? null
}

// ─── Trick Logic ──────────────────────────────────────────────────────────────

export function getLegalCards(hand: Card[], ledSuit: Suit | null): Card[] {
  if (!ledSuit) return hand // Leading: any card
  const suitCards = hand.filter(c => c.suit === ledSuit)
  return suitCards.length > 0 ? suitCards : hand // Must follow suit if possible
}

function cardBeats(
  challenger: Card,
  current: Card,
  ledSuit: Suit,
  trumpSuit: Suit | null,
): boolean {
  const challIsTrump = trumpSuit !== null && challenger.suit === trumpSuit
  const currIsTrump = trumpSuit !== null && current.suit === trumpSuit

  if (challIsTrump && !currIsTrump) return true
  if (!challIsTrump && currIsTrump) return false
  if (challenger.suit !== current.suit) return false // Off-suit, no trump → loses
  return RANK_VALUES[challenger.rank] > RANK_VALUES[current.rank]
}

export function resolveTrick(trick: TrickCard[], trumpSuit: Suit | null): string {
  if (trick.length === 0) throw new Error('Cannot resolve empty trick')
  const ledSuit = trick[0].card.suit
  let winner = trick[0]

  for (const played of trick.slice(1)) {
    if (cardBeats(played.card, winner.card, ledSuit, trumpSuit)) {
      winner = played
    }
  }
  return winner.uid
}

// ─── Bidding Logic ────────────────────────────────────────────────────────────

export function getBiddingOrder(playerOrder: string[], dealer: string): string[] {
  const dealerIdx = playerOrder.indexOf(dealer)
  const startIdx = (dealerIdx + 1) % playerOrder.length
  return [...playerOrder.slice(startIdx), ...playerOrder.slice(0, startIdx)]
}

export function getForbiddenBid(
  bids: Record<string, number>,
  biddingOrder: string[],
  cardsPerPlayer: number,
): number | null {
  const lastBidder = biddingOrder[biddingOrder.length - 1]
  const hasLastBidderBid = bids[lastBidder] >= 0

  if (hasLastBidderBid) return null // Last bidder already bid

  // Check if this is the last person to bid
  const remainingBidders = biddingOrder.filter(uid => bids[uid] < 0)
  if (remainingBidders.length !== 1 || remainingBidders[0] !== lastBidder) return null

  const sumSoFar = Object.values(bids)
    .filter(b => b >= 0)
    .reduce((a, b) => a + b, 0)

  const forbidden = cardsPerPlayer - sumSoFar
  if (forbidden < 0 || forbidden > cardsPerPlayer) return null
  return forbidden
}

export function getNextBidder(
  bids: Record<string, number>,
  biddingOrder: string[],
  justBid: string,
): string | null {
  const idx = biddingOrder.indexOf(justBid)
  for (let i = idx + 1; i < biddingOrder.length; i++) {
    if (bids[biddingOrder[i]] < 0) return biddingOrder[i]
  }
  return null // All have bid
}
