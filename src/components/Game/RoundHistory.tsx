import { useState, useEffect } from 'react'
import { getRoundResults } from '../../lib/tables'
import { SUIT_SYMBOLS, SUIT_COLORS } from '../../lib/cards'
import { isBotUid } from '../../lib/bots'
import type { RoundResult, TablePlayer } from '../../types'

interface Props {
  tableId: string
  playerOrder: string[]
  players: Record<string, TablePlayer>
  myUid: string
}

export default function RoundHistory({ tableId, playerOrder, players, myUid }: Props) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<RoundResult[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getRoundResults(tableId)
      setResults(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const shortName = (uid: string) => {
    const name = players[uid]?.displayName ?? uid
    return name.split(' ')[0]
  }

  return (
    <>
      {/* Trigger button */}
      <button
        className="history-btn"
        onClick={() => setOpen(v => !v)}
        title="Istoric jocuri"
      >
        📜
      </button>

      {/* Slide-in panel */}
      {open && (
        <div className="history-overlay" onClick={() => setOpen(false)}>
          <div className="history-panel" onClick={e => e.stopPropagation()}>
            <div className="history-header">
              <span>Istoric jocuri</span>
              <button className="history-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading && <div className="history-loading">Se încarcă...</div>}

            {!loading && results.length === 0 && (
              <div className="history-empty">Niciun joc finalizat încă.</div>
            )}

            {results.map(r => {
              const hasTrump = r.trumpSuit !== null
              return (
                <div key={r.roundIndex} className="history-round">
                  <div className="history-round-header">
                    <span className="history-round-num">Joc {r.roundNumber}</span>
                    <span className="history-round-meta">
                      {r.cardsPerPlayer} cărți
                    </span>
                    {hasTrump ? (
                      <span style={{ color: SUIT_COLORS[r.trumpSuit!] }}>
                        Atu: {SUIT_SYMBOLS[r.trumpSuit!]}
                      </span>
                    ) : (
                      <span className="history-no-trump">Fără atu</span>
                    )}
                  </div>

                  <div className="history-rows">
                    {/* Header */}
                    <div className="history-row history-row--header">
                      <span>Jucător</span>
                      <span title="Ture licitate">Lic.</span>
                      <span title="Ture câștigate">Câșt.</span>
                      <span title="Puncte această rundă">Pct.</span>
                      <span title="Total cumulativ">Total</span>
                    </div>
                    {playerOrder.map(uid => {
                      const bid   = r.bids[uid] ?? 0
                      const won   = r.tricksWon[uid] ?? 0
                      const delta = r.deltas[uid] ?? 0
                      const total = r.scoresAfter[uid] ?? 0
                      const hit   = bid === won
                      return (
                        <div
                          key={uid}
                          className={`history-row ${uid === myUid ? 'history-row--me' : ''} ${hit ? 'history-row--hit' : 'history-row--miss'}`}
                        >
                          <span className="history-player-name">
                            {isBotUid(uid) && players[uid]?.photoURL
                              ? <img src={players[uid].photoURL} alt="" className="history-avatar" />
                              : null
                            }
                            {shortName(uid)}
                          </span>
                          <span>{bid}</span>
                          <span className={hit ? 'text-hit' : 'text-miss'}>{won}</span>
                          <span className={delta > 0 ? 'text-hit' : delta < 0 ? 'text-miss' : ''}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                          <span className="history-total">{total}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
