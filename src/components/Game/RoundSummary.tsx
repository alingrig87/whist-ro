import type { TableMeta, RoundState, TablePlayer } from '../../types'
import { calculateRoundScore } from '../../lib/scoring'
import { applyRoundScores } from '../../lib/scoring'
import { SUIT_SYMBOLS, SUIT_NAMES_RO, SUIT_COLORS } from '../../lib/cards'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

interface Props {
  table: TableMeta
  round: RoundState
  players: Record<string, TablePlayer>
}

export default function RoundSummary({ table, round, players }: Props) {
  const { user } = useAuth()
  const isHost = user?.uid === table.createdBy
  const [advancing, setAdvancing] = useState(false)

  const { playerOrder, scores } = table
  const { bids, tricksWon, trumpSuit } = round

  const deltas = Object.fromEntries(
    playerOrder.map(uid => [
      uid,
      calculateRoundScore(bids[uid] ?? 0, tricksWon[uid] ?? 0),
    ]),
  )

  const handleContinue = async () => {
    setAdvancing(true)
    try {
      await applyRoundScores(table, round, players)
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="round-summary-overlay">
      <div className="round-summary">
        <h2 className="summary-title">
          Runda {round.roundNumber} completă!
        </h2>
        <div className="summary-meta">
          <span>{round.cardsPerPlayer} cărți/jucător</span>
          {trumpSuit ? (
            <span style={{ color: SUIT_COLORS[trumpSuit] }}>
              Atu: {SUIT_SYMBOLS[trumpSuit]} {SUIT_NAMES_RO[trumpSuit]}
            </span>
          ) : (
            <span>Fără atu</span>
          )}
        </div>

        <div className="summary-table">
          <div className="summary-row summary-row--header">
            <span>Jucător</span>
            <span>Licitat</span>
            <span>Câștigat</span>
            <span>Puncte</span>
            <span>Total nou</span>
          </div>

          {playerOrder.map(uid => {
            const player = players[uid]
            const bid = bids[uid] ?? 0
            const won = tricksWon[uid] ?? 0
            const delta = deltas[uid]
            const hit = bid === won

            return (
              <div
                key={uid}
                className={`summary-row ${uid === user?.uid ? 'summary-row--me' : ''}`}
              >
                <span className="summary-player">
                  <img src={player?.photoURL ?? ''} alt="" className="summary-avatar" />
                  {player?.displayName ?? uid}
                </span>
                <span>{bid}</span>
                <span className={hit ? 'text-success' : 'text-error'}>{won}</span>
                <span className={delta > 0 ? 'text-success' : 'text-error'}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                <span className="summary-total">
                  {(scores[uid] ?? 0) + delta}
                </span>
              </div>
            )
          })}
        </div>

        {table.currentRound < 14 ? (
          isHost ? (
            <button
              className="btn-primary btn-continue"
              onClick={handleContinue}
              disabled={advancing}
            >
              {advancing ? 'Se pregătește...' : `Continuă → Runda ${round.roundNumber + 1}`}
            </button>
          ) : (
            <p className="summary-waiting">⏳ Se așteaptă host-ul să continue...</p>
          )
        ) : (
          isHost ? (
            <button
              className="btn-primary btn-continue"
              onClick={handleContinue}
              disabled={advancing}
            >
              {advancing ? 'Se calculează...' : '🏆 Finalizează jocul'}
            </button>
          ) : (
            <p className="summary-waiting">⏳ Se așteaptă host-ul să finalizeze...</p>
          )
        )}
      </div>
    </div>
  )
}
