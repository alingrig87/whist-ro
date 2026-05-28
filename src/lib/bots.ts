/**
 * Bot player logic — random but rule-compliant play.
 *
 * Bots are stored in Firestore as regular players with isBot:true and uid
 * starting with "bot-". The host's client detects bot turns and auto-plays
 * on their behalf after a short delay (BOT_DELAY_MS).
 */

import {
  getForbiddenBid,
  getBiddingOrder,
  getLegalCards,
} from './cards'
import type { RoundState, PlayerHand } from '../types'

// ─── Bot Identifiers ──────────────────────────────────────────────────────────

export const BOT_UIDS = ['bot-1', 'bot-2', 'bot-3', 'bot-4', 'bot-5'] as const
export const BOT_NAMES: Record<string, string> = {
  'bot-1': '🤖 Bot Unu',
  'bot-2': '🤖 Bot Doi',
  'bot-3': '🤖 Bot Trei',
  'bot-4': '🤖 Bot Patru',
  'bot-5': '🤖 Bot Cinci',
}

/** Time in ms the bot "thinks" before acting — enough to feel natural */
export const BOT_DELAY_MS = 1200

export function isBotUid(uid: string): boolean {
  return uid.startsWith('bot-')
}

// ─── Bot AI: Bidding ──────────────────────────────────────────────────────────

/**
 * Returns a valid random bid for the bot.
 * Avoids the forbidden bid (last player cannot make sum equal to total tricks).
 */
export function getBotBid(round: RoundState, playerOrder: string[]): number {
  const biddingOrder = getBiddingOrder(playerOrder, round.dealer)
  const forbidden = getForbiddenBid(round.bids, biddingOrder, round.cardsPerPlayer)

  // Try up to 50 random bids, then fall back to linear search
  for (let attempt = 0; attempt < 50; attempt++) {
    const bid = Math.floor(Math.random() * (round.cardsPerPlayer + 1))
    if (bid !== forbidden) return bid
  }

  // Linear fallback (always finds a valid bid since forbidden is at most one value)
  for (let b = 0; b <= round.cardsPerPlayer; b++) {
    if (b !== forbidden) return b
  }

  return 0 // Should never reach here
}

// ─── Bot AI: Card Play ────────────────────────────────────────────────────────

/**
 * Returns the card ID the bot will play.
 * Picks a random legal card (must-follow-suit rule respected via getLegalCards).
 */
export function getBotCard(hand: PlayerHand, round: RoundState): string {
  const ledSuit = round.currentTrick.length > 0
    ? round.currentTrick[0].card.suit
    : null

  const legal = getLegalCards(hand.cards, ledSuit, round.trumpSuit)
  if (legal.length === 0) return hand.cards[0]?.id ?? ''

  return legal[Math.floor(Math.random() * legal.length)].id
}
