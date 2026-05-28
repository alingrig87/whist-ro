// ─── Card Types ──────────────────────────────────────────────────────────────

export type Suit = 'S' | 'H' | 'D' | 'C' // Spades, Hearts, Diamonds, Clubs
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
  id: string // e.g. 'AS', 'KH', '10D'
}

export interface TrickCard {
  uid: string
  card: Card
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string
  createdAt: Date
  totalGames: number
  totalWins: number
  totalScore: number
}

// ─── Table Types ──────────────────────────────────────────────────────────────

export type TableStatus = 'waiting' | 'playing' | 'finished'

/**
 * Mountain (Munte): starts and ends with 8 cards, valley of 1s in the middle.
 * Sequence: [8×N, 7, 6, 5, 4, 3, 2, 1×N, 2, 3, 4, 5, 6, 7, 8×N]
 *
 * Valley (Vale): starts and ends with 1 card, peak of 8s in the middle.
 * Sequence: [1×N, 2, 3, 4, 5, 6, 7, 8×N, 7, 6, 5, 4, 3, 2, 1×N]
 *
 * Both modes have 3N+12 total rounds.
 */
export type GameMode = 'mountain' | 'valley'

export interface TableMeta {
  id: string
  name: string
  createdBy: string
  createdAt: Date
  status: TableStatus
  playerOrder: string[]
  maxPlayers: number
  scores: Record<string, number>
  currentRound: number
  totalRounds: number
  gameMode: GameMode
  /** Computed at game start: array of cardsPerPlayer for each round index */
  roundSequence: number[]
  /** Tracks consecutive exact-bid hits per player (non-1-card rounds only) */
  consecutiveHits: Record<string, number>
  groupId: string | null
}

export interface TablePlayer {
  uid: string
  displayName: string
  photoURL: string
  ready: boolean
  joinedAt: Date
  isBot?: boolean
}

// ─── Round Types ──────────────────────────────────────────────────────────────

export type RoundPhase = 'dealing' | 'bidding' | 'playing' | 'scoring'

export interface RoundState {
  roundNumber: number
  cardsPerPlayer: number
  trumpSuit: Suit | null
  dealer: string
  phase: RoundPhase
  bids: Record<string, number> // -1 = not yet bid
  tricksWon: Record<string, number>
  currentTrick: TrickCard[]
  trickLeader: string
  currentPlayer: string
}

export interface PlayerHand {
  cards: Card[]
}

// ─── Game Archive Types ───────────────────────────────────────────────────────

export interface PlayerResult {
  uid: string
  displayName: string
  photoURL: string
  score: number
  rank: number
}

export interface GameRecord {
  id: string
  tableId: string
  groupId: string | null
  players: PlayerResult[]
  winner: string
  finishedAt: Date
  totalRounds: number
}

// ─── Group Types ──────────────────────────────────────────────────────────────

export interface Group {
  id: string
  name: string
  description: string
  createdBy: string
  createdAt: Date
  inviteCode: string
  memberUids: string[]
}

export type GroupMemberRole = 'admin' | 'member'

export interface GroupMember {
  uid: string
  displayName: string
  photoURL: string
  role: GroupMemberRole
  joinedAt: Date
  gamesPlayed: number
  wins: number
  totalScore: number
}

// ─── UI Helper Types ──────────────────────────────────────────────────────────

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}
