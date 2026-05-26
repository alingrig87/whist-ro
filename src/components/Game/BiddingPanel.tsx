import {
  SUIT_SYMBOLS,
  SUIT_NAMES_RO,
  SUIT_COLORS,
  getBiddingOrder,
  getForbiddenBid,
  getNextBidder,
} from '../../lib/cards'
import { submitBid, transitionToPlaying } from '../../lib/tables'
import type { RoundState, TableMeta } from '../../types'
import { useAuth } from '../../context/AuthContext'

interface Props {
  table: TableMeta
  round: RoundState
}

export default function BiddingPanel({ table, round }: Props) {
  const { user } = useAuth()
  const { playerOrder } = table
  const { bids, cardsPerPlayer, trumpSuit, dealer, phase } = round

  const biddingOrder = getBiddingOrder(playerOrder, dealer)
  const isMyTurn = round.currentPlayer === user?.uid && phase === 'bidding'
  const forbiddenBid = isMyTurn
    ? getForbiddenBid(bids, biddingOrder, cardsPerPlayer)
    : null

  const handleBid = async (bid: number) => {
    if (!user || !isMyTurn) return

    const nextPlayer = getNextBidder(bids, biddingOrder, user.uid)
    await submitBid(table.id, table.currentRound, user.uid, bid, nextPlayer)

    if (nextPlayer === null) {
      // All have bid — transition to playing
      const firstPlayer = biddingOrder[0]
      await transitionToPlaying(table.id, table.currentRound, firstPlayer)
    }
  }

  const currentBidderIdx = biddingOrder.findIndex(uid => bids[uid] === -1)
  const currentBidder = currentBidderIdx >= 0 ? biddingOrder[currentBidderIdx] : null

  return (
    <div className="bidding-panel">
      {/* Round info */}
      <div className="bidding-info">
        <span className="bidding-round-label">
          Runda {round.roundNumber}/15 — {cardsPerPlayer} cărți/jucător
        </span>
        {trumpSuit ? (
          <span className="bidding-trump" style={{ color: SUIT_COLORS[trumpSuit] }}>
            Atu: {SUIT_SYMBOLS[trumpSuit]} {SUIT_NAMES_RO[trumpSuit]}
          </span>
        ) : (
          <span className="bidding-trump bidding-trump--none">Fără atu</span>
        )}
      </div>

      {/* Bids so far */}
      <div className="bidding-summary">
        {biddingOrder.map(uid => {
          const bid = bids[uid]
          return (
            <div key={uid} className={`bid-row ${uid === user?.uid ? 'bid-row--me' : ''}`}>
              <span className="bid-player">{uid === user?.uid ? 'Tu' : '—'}</span>
              <span className={`bid-value ${bid === -1 ? 'bid-value--waiting' : ''}`}>
                {bid === -1 ? '…' : bid}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bidding buttons */}
      {isMyTurn ? (
        <div className="bidding-actions">
          <p className="bidding-prompt">Tu licitezi (0–{cardsPerPlayer}):</p>
          <div className="bid-buttons">
            {Array.from({ length: cardsPerPlayer + 1 }, (_, i) => i).map(n => (
              <button
                key={n}
                className={[
                  'bid-btn',
                  n === forbiddenBid ? 'bid-btn--forbidden' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleBid(n)}
                disabled={n === forbiddenBid}
                title={
                  n === forbiddenBid
                    ? 'Licitație interzisă — suma ar fi egală cu totalul'
                    : ''
                }
              >
                {n}
                {n === forbiddenBid && <span className="forbidden-x">✕</span>}
              </button>
            ))}
          </div>
          {forbiddenBid !== null && (
            <p className="forbidden-note">
              ⚠ Nu poți licita {forbiddenBid} — suma ar fi egală cu {cardsPerPlayer}
            </p>
          )}
        </div>
      ) : (
        <div className="bidding-waiting">
          {currentBidder ? (
            <p>⏳ Se așteaptă licitația...</p>
          ) : (
            <p>✅ Toți au licitat. Se trece la joc...</p>
          )}
        </div>
      )}
    </div>
  )
}
