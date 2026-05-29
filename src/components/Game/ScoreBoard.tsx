import type { TableMeta, RoundState, TablePlayer } from '../../types'
import { calculateRoundScore } from '../../lib/scoring'
import { useAuth } from '../../context/AuthContext'
import { isBotUid } from '../../lib/bots'
import { SUIT_SYMBOLS, SUIT_COLORS } from '../../lib/cards'

interface Props {
  table: TableMeta
  round: RoundState
  players: Record<string, TablePlayer>
}

const RANK_MEDAL = ['🥇', '🥈', '🥉', '4.', '5.', '6.']

export default function ScoreBoard({ table, round, players }: Props) {
  const { user } = useAuth()
  const { playerOrder, scores } = table
  const { bids, tricksWon, phase } = round

  const isPlaying = phase === 'playing' || phase === 'scoring'

  // Sort by score descending for ranking
  const sorted = [...playerOrder].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))

  // Progress through round sequence
  const progress = table.roundSequence.length > 0
    ? Math.round((table.currentRound / table.roundSequence.length) * 100)
    : 0

  return (
    <div className="scoreboard">

      {/* Round info header */}
      <div className="sb-round-info">
        <div className="sb-round-title">
          Joc <strong>{round.roundNumber}</strong> / {table.totalRounds}
        </div>
        <div className="sb-round-details">
          <span>{round.cardsPerPlayer} {round.cardsPerPlayer === 1 ? 'carte' : 'cărți'}/jucător</span>
          {round.trumpCard ? (
            <span style={{ color: SUIT_COLORS[round.trumpCard.suit] }}>
              Atu: <strong>{round.trumpCard.rank}{SUIT_SYMBOLS[round.trumpCard.suit]}</strong>
            </span>
          ) : (
            <span className="sb-no-trump">Fără atu</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="sb-progress-bar">
          <div className="sb-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Leaderboard rows (sorted by score) */}
      <div className="sb-rows">
        {sorted.map((uid, rankIdx) => {
          const player = players[uid]
          const bid = bids[uid] ?? -1
          const won = tricksWon[uid] ?? 0
          const hasBid = bid >= 0
          const isCurrentPlayer = round.currentPlayer === uid
          const delta = hasBid && isPlaying ? calculateRoundScore(bid, won) : null
          const hitBid  = hasBid && isPlaying && won === bid
          const missBid = hasBid && isPlaying && won !== bid
          const totalWithDelta = (scores[uid] ?? 0) + (delta ?? 0)

          // Streak info
          const hits   = table.consecutiveHits[uid]   ?? 0
          const misses = table.consecutiveMisses[uid] ?? 0

          return (
            <div
              key={uid}
              className={[
                'sb-row',
                uid === user?.uid   ? 'sb-row--me'      : '',
                isCurrentPlayer     ? 'sb-row--active'  : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Rank */}
              <span className="sb-rank">{RANK_MEDAL[rankIdx] ?? `${rankIdx + 1}.`}</span>

              {/* Avatar */}
              {player?.photoURL
                ? <img src={player.photoURL} alt="" className="sb-avatar" />
                : <div className={`sb-avatar sb-avatar--placeholder ${isBotUid(uid) ? 'sb-avatar--bot' : ''}`}>
                    {isBotUid(uid) ? '🤖' : '👤'}
                  </div>
              }

              {/* Name + streak */}
              <div className="sb-info">
                <span className="sb-name">{player?.displayName ?? uid}</span>
                {hits >= 2 && (
                  <span className="sb-streak sb-streak--hit" title={`${hits} nimereli la rând`}>
                    🔥 {hits}
                  </span>
                )}
                {misses >= 2 && (
                  <span className="sb-streak sb-streak--miss" title={`${misses} greșeli la rând`}>
                    ❄️ {misses}
                  </span>
                )}
              </div>

              {/* Bid vs won */}
              <div className="sb-bid-won" title="ture câștigate / licitate">
                {hasBid ? (
                  <span className={hitBid ? 'bw-hit' : missBid ? 'bw-miss' : ''}>
                    {isPlaying ? `${won}/${bid}` : `?/${bid}`} <span className="sb-ture-label">ture</span>
                  </span>
                ) : (
                  <span className="bw-waiting">…</span>
                )}
              </div>

              {/* Score */}
              <div className="sb-score-col">
                {delta !== null && (
                  <span className={`sb-delta ${delta > 0 ? 'sb-delta--pos' : delta < 0 ? 'sb-delta--neg' : 'sb-delta--zero'}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
                <span className="sb-total">{totalWithDelta}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Round sequence mini-map */}
      {table.roundSequence.length > 0 && (
        <div className="sb-sequence">
          {table.roundSequence.map((cards, i) => (
            <span
              key={i}
              className={[
                'sb-seq-dot',
                i < table.currentRound  ? 'sb-seq-dot--done'    : '',
                i === table.currentRound ? 'sb-seq-dot--current' : '',
                cards === 1 ? 'sb-seq-dot--one' : '',
                cards === 8 ? 'sb-seq-dot--eight' : '',
              ].filter(Boolean).join(' ')}
              title={`Runda ${i + 1}: ${cards} cărți`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
