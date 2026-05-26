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
  groupId: string | null
}

export interface TablePlayer {
  uid: string
  displayName: string
  photoURL: string
  ready: boolean
  joinedAt: Date
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
