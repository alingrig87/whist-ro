import type { TableMeta, RoundState, TablePlayer } from '../../types'
import { calculateRoundScore } from '../../lib/scoring'
import { useAuth } from '../../context/AuthContext'
import { isBotUid } from '../../lib/bots'

interface Props {
  table: TableMeta
  round: RoundState
  players: Record<string, TablePlayer>
}

export default function ScoreBoard({ table, round, players }: Props) {
  const { user } = useAuth()
  const { playerOrder, scores } = table
  const { bids, tricksWon, cardsPerPlayer, phase } = round

  return (
    <div className="scoreboard">
      <div className="scoreboard-header">
        <span>Scoruri</span>
        <span className="scoreboard-round">
          Runda {round.roundNumber}/{table.totalRounds}
        </span>
      </div>

      <div className="scoreboard-rows">
        {playerOrder.map(uid => {
          const player = players[uid]
          const bid = bids[uid]
          const won = tricksWon[uid] ?? 0
          const hasBid = bid >= 0
          const isPlaying = phase === 'playing' || phase === 'scoring'
          const delta = hasBid && isPlaying
            ? calculateRoundScore(bid, won)
            : null

          const hitBid = hasBid && isPlaying && won === bid
          const missedBid = hasBid && isPlaying && won !== bid

          return (
            <div
              key={uid}
              className={`scoreboard-row ${uid === user?.uid ? 'scoreboard-row--me' : ''}`}
            >
              {player?.photoURL
                ? <img src={player.photoURL} alt="" className="scoreboard-avatar" />
                : <div className="scoreboard-avatar--placeholder">
                    {isBotUid(uid) ? '🤖' : '👤'}
                  </div>
              }
              <div className="scoreboard-name">
                {player?.displayName ?? uid}
              </div>

              {/* Bid / tricks */}
              <div className="scoreboard-bid-tricks">
                {hasBid ? (
                  <>
                    <span className="bid-label">{bid}</span>
                    {isPlaying && (
                      <>
                        <span className="bid-sep">/</span>
                        <span
                          className={`tricks-won ${hitBid ? 'tricks--hit' : ''} ${missedBid ? 'tricks--miss' : ''}`}
                        >
                          {won}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="bid-waiting">…</span>
                )}
              </div>

              {/* Round delta */}
              <div className={`score-delta ${delta !== null && delta > 0 ? 'score-delta--pos' : delta !== null && delta < 0 ? 'score-delta--neg' : ''}`}>
                {delta !== null ? (delta > 0 ? `+${delta}` : `${delta}`) : ''}
              </div>

              {/* Total */}
              <div className="score-total">
                {(scores[uid] ?? 0) + (delta ?? 0)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
