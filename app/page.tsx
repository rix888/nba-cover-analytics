'use client'

import { Fragment, useEffect, useState } from 'react'

type Team = {
  id: number
  name: string
  abbreviation: string
  city: string
  conference: string
}

type Game = {
  id: number
  date: string
  season: number
  home_team_id: number
  away_team_id: number
  home_q1: number
  home_q2: number
  home_q3: number
  home_q4: number
  away_q1: number
  away_q2: number
  away_q3: number
  away_q4: number
  home_final: number
  away_final: number
  datetime: string
}

type Player = {
  id: number
  first_name: string
  last_name: string
  position: string
}

type PlayerStat = {
  id: number
  game_id: number
  player_id: number
  team_id: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  min: string
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  turnover: number
  player?: {
    id: number
    first_name: string
    last_name: string
    position: string
  } | null
}

type GameOdd = {
  id: number
  game_id: number
  nba_game_id: string | null
  market_key: 'spreads' | 'spreads_h1' | 'spreads_q1'
  bookmaker: string
  team_name: string
  team_id: number | null
  point: number
  price: number
  pulled_at: string
  commence_time: string | null
}

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedSeason, setSelectedSeason] = useState('2025')
  const [seasonType, setSeasonType] = useState<'regular' | 'playoffs'>('regular')
  const [loading, setLoading] = useState(false)
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null)
  const [gameStats, setGameStats] = useState<Record<number, PlayerStat[]>>({})
  const [loadingStats, setLoadingStats] = useState<number | null>(null)
  const [playersById, setPlayersById] = useState<Record<number, Player>>({})
  const [gameOdds, setGameOdds] = useState<Record<number, GameOdd[]>>({})

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then((data) => {
        console.log('teams response:', data)
        setTeams(data)
      })
      .catch(error => {
        console.error('Failed to load teams:', error)
      })
  }, [])  

  useEffect(() => {
    fetch('/api/all-players')
      .then(res => res.json())
      .then((data) => {
        console.log('all-players response:', data)
  
        if (!Array.isArray(data)) {
          console.error('Expected array from /api/all-players, got:', data)
          return
        }
  
        const map: Record<number, Player> = {}
  
        for (const player of data) {
          map[player.id] = player
        }
  
        setPlayersById(map)
      })
      .catch(error => {
        console.error('Failed to load players:', error)
      })
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    setLoading(true)
    setExpandedGameId(null)
    fetch(
      `/api/games?team_id=${selectedTeam.id}&season=${selectedSeason}&season_type=${seasonType}`
    )
      .then(res => res.json())
      .then(async data => {
        setGames(data)
      
        if (seasonType === 'playoffs' && Array.isArray(data) && data.length > 0) {
          const gameIds = data.map((game: Game) => game.id)
      
          const oddsRes = await fetch('/api/odds/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gameIds }),
          })
      
          const oddsData: GameOdd[] = await oddsRes.json()
      
          if (Array.isArray(oddsData)) {
            const oddsMap: Record<number, GameOdd[]> = {}
      
            for (const odd of oddsData) {
              if (!oddsMap[odd.game_id]) {
                oddsMap[odd.game_id] = []
              }
      
              oddsMap[odd.game_id].push(odd)
            }
      
            setGameOdds(oddsMap)
          }
        } else {
          setGameOdds({})
        }
      
        setLoading(false)
      })
  }, [selectedTeam, selectedSeason, seasonType])

  async function toggleGame(gameId: number) {
    if (expandedGameId === gameId) {
      setExpandedGameId(null)
      return
    }
    setExpandedGameId(gameId)
    if (gameStats[gameId]) return
    setLoadingStats(gameId)
    const res = await fetch(`/api/players?game_id=${gameId}`)
    const data = await res.json()
    setGameStats(prev => ({ ...prev, [gameId]: data }))
    setLoadingStats(null)
    if (!gameOdds[gameId]) {
      const oddsRes = await fetch(`/api/odds?game_id=${gameId}`)
      const oddsData = await oddsRes.json()
    
      setGameOdds(prev => ({
        ...prev,
        [gameId]: Array.isArray(oddsData) ? oddsData : [],
      }))
    }
  }

  function wonQ1(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamQ1 = isHome ? game.home_q1 : game.away_q1
    const oppQ1 = isHome ? game.away_q1 : game.home_q1
    return teamQ1 > oppQ1
  }

  function wonFirstHalf(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamH1 = isHome ? game.home_q1 + game.home_q2 : game.away_q1 + game.away_q2
    const oppH1 = isHome ? game.away_q1 + game.away_q2 : game.home_q1 + game.home_q2
    return teamH1 > oppH1
  }

  function wonGame(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamFinal = isHome ? game.home_final : game.away_final
    const oppFinal = isHome ? game.away_final : game.home_final
    return teamFinal > oppFinal
  }

  function getSpreadResult(teamScore: number, oppScore: number, spread?: number | null) {
    if (spread === undefined || spread === null) return null
  
    const margin = teamScore - oppScore
    const adjusted = margin + spread
  
    if (adjusted > 0) return 'covered'
    if (adjusted < 0) return 'missed'
    return 'push'
  }

  function getCoverLabel(result: string | null) {
    if (result === 'covered') return 'Covered'
    if (result === 'missed') return 'Missed'
    if (result === 'push') return 'Push'
    return '—'
  }

  function isCompletedGame(game: Game) {
    return (
      game.status === 'Final' &&
      (game.home_final > 0 || game.away_final > 0)
    )
  }

  function getOpponentId(game: Game) {
    return game.home_team_id === selectedTeam?.id
      ? game.away_team_id
      : game.home_team_id
  }

  function getAbbr(id: number) {
    return teams.find(t => t.id === id)?.abbreviation ?? '???'
  }

  function getTeamName(id: number) {
    const t = teams.find(t => t.id === id)
    return t ? `${t.city} ${t.name}` : '???'
  }

  function fgPct(made: number, att: number) {
    if (att === 0) return '—'
    return `${Math.round((made / att) * 100)}%`
  }

  function formatMin(min: string) {
    if (!min) return '—'
    const match = min.match(/PT(\d+)M/)
    if (match) return `${match[1]}m`
    return min
  }

  const completedGames = games.filter(isCompletedGame)
  const homeGames = completedGames.filter(g => g.home_team_id === selectedTeam?.id)
  const awayGames = completedGames.filter(g => g.away_team_id === selectedTeam?.id)

  const visibleGames = games.filter(game => {
    const hasOdds = (gameOdds[game.id] ?? []).length > 0
    return isCompletedGame(game) || hasOdds
  })
  
  function getSelectedTeamOdds(gameId: number, marketKey: string) {
    const odds = gameOdds[gameId] ?? []
  
    return odds.find(
      o => o.team_id === selectedTeam?.id && o.market_key === marketKey
    )
  }
  
  function coveredQ1(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamQ1 = isHome ? game.home_q1 : game.away_q1
    const oppQ1 = isHome ? game.away_q1 : game.home_q1
    const odds = getSelectedTeamOdds(game.id, 'spreads_q1')
  
    return getSpreadResult(teamQ1, oppQ1, odds?.point) === 'covered'
  }
  
  function coveredHalf(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamHalf = isHome
      ? game.home_q1 + game.home_q2
      : game.away_q1 + game.away_q2
  
    const oppHalf = isHome
      ? game.away_q1 + game.away_q2
      : game.home_q1 + game.home_q2
  
    const odds = getSelectedTeamOdds(game.id, 'spreads_h1')
  
    return getSpreadResult(teamHalf, oppHalf, odds?.point) === 'covered'
  }
  
  function coveredGame(game: Game) {
    const isHome = game.home_team_id === selectedTeam?.id
    const teamFinal = isHome ? game.home_final : game.away_final
    const oppFinal = isHome ? game.away_final : game.home_final
    const odds = getSelectedTeamOdds(game.id, 'spreads')
  
    return getSpreadResult(teamFinal, oppFinal, odds?.point) === 'covered'
  }
  
  const q1Wins =
    seasonType === 'playoffs'
      ? completedGames.filter(coveredQ1).length
      : completedGames.filter(wonQ1).length
  
  const halfWins =
    seasonType === 'playoffs'
      ? completedGames.filter(coveredHalf).length
      : completedGames.filter(wonFirstHalf).length
  
  const gameWins =
    seasonType === 'playoffs'
      ? completedGames.filter(coveredGame).length
      : completedGames.filter(wonGame).length
  
  const homeQ1Wins =
    seasonType === 'playoffs'
      ? homeGames.filter(coveredQ1).length
      : homeGames.filter(wonQ1).length
  
  const awayQ1Wins =
    seasonType === 'playoffs'
      ? awayGames.filter(coveredQ1).length
      : awayGames.filter(wonQ1).length
  
  const homeHalfWins =
    seasonType === 'playoffs'
      ? homeGames.filter(coveredHalf).length
      : homeGames.filter(wonFirstHalf).length
  
  const awayHalfWins =
    seasonType === 'playoffs'
      ? awayGames.filter(coveredHalf).length
      : awayGames.filter(wonFirstHalf).length
  
  const homeGameWins =
    seasonType === 'playoffs'
      ? homeGames.filter(coveredGame).length
      : homeGames.filter(wonGame).length
  
  const awayGameWins =
    seasonType === 'playoffs'
      ? awayGames.filter(coveredGame).length
      : awayGames.filter(wonGame).length
  
  const q1WinPct = completedGames.length ? Math.round((q1Wins / completedGames.length) * 100) : 0
  const halfWinPct = completedGames.length ? Math.round((halfWins / completedGames.length) * 100) : 0
  const gameWinPct = completedGames.length ? Math.round((gameWins / completedGames.length) * 100) : 0
  
  const homeQ1WinPct = homeGames.length ? Math.round((homeQ1Wins / homeGames.length) * 100) : 0
  const awayQ1WinPct = awayGames.length ? Math.round((awayQ1Wins / awayGames.length) * 100) : 0
  
  const homeHalfWinPct = homeGames.length ? Math.round((homeHalfWins / homeGames.length) * 100) : 0
  const awayHalfWinPct = awayGames.length ? Math.round((awayHalfWins / awayGames.length) * 100) : 0
  
  const homeGameWinPct = homeGames.length ? Math.round((homeGameWins / homeGames.length) * 100) : 0
  const awayGameWinPct = awayGames.length ? Math.round((awayGameWins / awayGames.length) * 100) : 0
  
  const avgQ1Diff = completedGames.length
    ? (
        completedGames.reduce((acc, g) => {
          const isHome = g.home_team_id === selectedTeam?.id
          const teamQ1 = isHome ? g.home_q1 : g.away_q1
          const oppQ1 = isHome ? g.away_q1 : g.home_q1
          return acc + (teamQ1 - oppQ1)
        }, 0) / completedGames.length
      ).toFixed(1)
    : '0.0'

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'sans-serif',
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>NBA Cover Analytics</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Analyze team performance against the spread across quarters, halves, and full games.</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <select
          value={selectedSeason}
          onChange={e => {
            setSelectedSeason(e.target.value)
            setExpandedGameId(null)
          }}
          style={selectStyle}
        >
          <option value="2025">2025-26</option>
          <option value="2024">2024-25</option>
        </select>

        <select
          value={seasonType}
          onChange={e => {
            setSeasonType(e.target.value as 'regular' | 'playoffs')
            setExpandedGameId(null)
          }}
          style={selectStyle}
        >
          <option value="regular">Regular Season</option>
          <option value="playoffs">Playoffs</option>
        </select>

        <select
          value={selectedTeam?.id ?? ''}
          onChange={e => {
            const team = teams.find(t => t.id === parseInt(e.target.value))
            setSelectedTeam(team ?? null)
          }}
          style={{ ...selectStyle, minWidth: 220 }}
        >
          <option value=''>Select a team...</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.city} {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {selectedTeam && !loading && games.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            {
              label: 'Games played',
              value: completedGames.length,
              subtext: `Home: ${homeGames.length} | Away: ${awayGames.length}`,
            },
            {
              label: seasonType === 'playoffs' ? '1ST QUARTER COVERS' : '1ST QUARTER WINS',
              value: `${q1Wins} (${q1WinPct}%)`,
              subtext: `Home: ${homeQ1Wins} (${homeQ1WinPct}%)\nAway: ${awayQ1Wins} (${awayQ1WinPct}%)`,
            },
            {
              label: seasonType === 'playoffs' ? '1ST HALF COVERS' : '1ST HALF WINS',
              value: `${halfWins} (${halfWinPct}%)`,
              subtext: `Home: ${homeHalfWins} (${homeHalfWinPct}%)\nAway: ${awayHalfWins} (${awayHalfWinPct}%)`,
            },
            {
              label: seasonType === 'playoffs' ? 'FULL GAME COVERS' : 'FULL GAME WINS',
              value: `${gameWins} (${gameWinPct}%)`,
              subtext: `Home: ${homeGameWins} (${homeGameWinPct}%)\nAway: ${awayGameWins} (${awayGameWinPct}%)`,
            },
            // {
            //   label: 'Avg Q1 diff',
            //   value: `${Number(avgQ1Diff) > 0 ? '+' : ''}${avgQ1Diff}`,
            //   subtext: '',
            // },
          ].map(card => (
            <div
            key={card.label}
            style={{
              background: 'var(--card)',
              borderRadius: 10,
              padding: '1rem',
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
            >
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {card.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
              {card.value}
            </div>
            {card.subtext ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  marginTop: 6,
                  whiteSpace: 'pre-line',
                }}
              >
                {card.subtext}
              </div>
            ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Games Table */}
      {loading && <p style={{ color: 'var(--muted)' }}>Loading games...</p>}

      {!loading && selectedTeam && games.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--table-header)', textAlign: 'left' }}>
                <th style={th}></th>
                <th style={th}>Date</th>
                <th style={th}>Opponent</th>
                <th style={th}>Q1</th>
                <th style={th}>Q2</th>
                <th style={th}>Half</th>
                <th style={th}>Q3</th>
                <th style={th}>Q4</th>
                <th style={th}>Final</th>
                <th style={th}>Won Q1</th>
                <th style={th}>Won Half</th>
                <th style={th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {visibleGames.map(game => {
                const isHome = game.home_team_id === selectedTeam.id
                const oppId = getOpponentId(game)
                const tQ1 = isHome ? game.home_q1 : game.away_q1
                const oQ1 = isHome ? game.away_q1 : game.home_q1
                const tQ2 = isHome ? game.home_q2 : game.away_q2
                const oQ2 = isHome ? game.away_q2 : game.home_q2
                const tHalf = tQ1 + tQ2
                const oHalf = oQ1 + oQ2
                const tQ3 = isHome ? game.home_q3 : game.away_q3
                const oQ3 = isHome ? game.away_q3 : game.home_q3
                const tQ4 = isHome ? game.home_q4 : game.away_q4
                const oQ4 = isHome ? game.away_q4 : game.home_q4
                const tFinal = isHome ? game.home_final : game.away_final
                const oFinal = isHome ? game.away_final : game.home_final
                const wQ1 = wonQ1(game)
                const wHalf = wonFirstHalf(game)
                const wGame = wonGame(game)
                const isExpanded = expandedGameId === game.id
                const stats = Array.isArray(gameStats[game.id])
                ? gameStats[game.id].map(stat => ({
                    ...stat,
                    player: playersById[stat.player_id] ?? null,
                  }))
                : []
                const homeStats = stats.filter(s => s.team_id === game.home_team_id)
                const awayStats = stats.filter(s => s.team_id === game.away_team_id)
                const odds = gameOdds[game.id] ?? []
                const selectedTeamQ1Odds = odds.find(
                  o => o.team_id === selectedTeam.id && o.market_key === 'spreads_q1'
                )
                const selectedTeamH1Odds = odds.find(
                  o => o.team_id === selectedTeam.id && o.market_key === 'spreads_h1'
                )
                const selectedTeamGameOdds = odds.find(
                  o => o.team_id === selectedTeam.id && o.market_key === 'spreads'
                )
                const isFinal = isCompletedGame(game)
                const q1CoverResult =
                  seasonType === 'playoffs' && isFinal
                    ? getSpreadResult(tQ1, oQ1, selectedTeamQ1Odds?.point)
                    : null
                const h1CoverResult =
                  seasonType === 'playoffs' && isFinal
                    ? getSpreadResult(tQ1 + tQ2, oQ1 + oQ2, selectedTeamH1Odds?.point)
                    : null
                const gameCoverResult =
                  seasonType === 'playoffs' && isFinal
                    ? getSpreadResult(tFinal, oFinal, selectedTeamGameOdds?.point)
                    : null

                return (
                  <Fragment key={game.id}>
                    <tr
                      onClick={() => toggleGame(game.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isExpanded ? 'var(--table-header)' : 'var(--card)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header)')}
                      onMouseLeave={e =>
                        (e.currentTarget.style.background = isExpanded ? 'var(--table-header)' : 'var(--card)')
                      }
                    >
                      <td style={{ ...td, color: '#aaa', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</td>
                      <td style={td}>{game.date.slice(0, 10)}</td>
                      {/* <td style={{ ...td, fontSize: 10, color: '#999' }}>ID: {game.id}</td> */}
                      <td style={td}>{isHome ? 'vs' : '@'} {getAbbr(oppId)}</td>
                      <td style={td}>{isFinal ? `${tQ1}–${oQ1}` : '—'}</td>
                      <td style={td}>{isFinal ? `${tQ2}–${oQ2}` : '—'}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{isFinal ? `${tHalf}–${oHalf}` : '—'}</td>
                      <td style={td}>{isFinal ? `${tQ3}–${oQ3}` : '—'}</td>
                      <td style={td}>{isFinal ? `${tQ4}–${oQ4}` : '—'}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{isFinal ? `${tFinal}–${oFinal}` : '—'}</td>
                      <td style={td}>
                        {seasonType === 'playoffs'
                          ? <CoverBadge result={q1CoverResult} />
                          : <Badge yes={wQ1} />}
                      </td>
                      <td style={td}>
                        {seasonType === 'playoffs'
                          ? <CoverBadge result={h1CoverResult} />
                          : <Badge yes={wHalf} />}  
                      </td>
                      <td style={td}>
                        {seasonType === 'playoffs'
                          ? <CoverBadge result={gameCoverResult} />
                          : <Badge yes={wGame} label={wGame ? 'W' : 'L'} />}
                      </td>
                    </tr>

                    {/* Expanded player stats row */}
                    {isExpanded && (
                      <tr key={`${game.id}-stats`}>
                        <td
                          colSpan={12}
                          style={{
                            padding: '0 0 16px 0',
                            background: 'var(--table-header)',
                            borderBottom: '2px solid var(--border)',
                          }}
                        >
                          {loadingStats === game.id ? (
                            <p style={{ padding: '1rem', color: 'var(--muted)' }}>
                              Loading game details...
                            </p>
                          ) : (
                            <>
                              {seasonType === 'playoffs' && odds.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                    padding: '12px 8px 0',
                                    fontSize: 12,
                                    color: 'var(--text)',
                                  }}
                                >
                                  <span>
                                    Q1:{' '}
                                    {selectedTeamQ1Odds
                                      ? `${selectedTeamQ1Odds.point} (${selectedTeamQ1Odds.price})`
                                      : '—'}
                                  </span>

                                  <span>
                                    1H:{' '}
                                    {selectedTeamH1Odds
                                      ? `${selectedTeamH1Odds.point} (${selectedTeamH1Odds.price})`
                                      : '—'}
                                  </span>

                                  <span>
                                    Game:{' '}
                                    {selectedTeamGameOdds
                                      ? `${selectedTeamGameOdds.point} (${selectedTeamGameOdds.price})`
                                      : '—'}
                                  </span>
                                </div>
                              )}

                              {stats.length === 0 ? (
                                <p style={{ padding: '1rem', color: 'var(--muted)' }}>
                                  Player stats will be available after the game is final.
                                </p>
                              ) : (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 16,
                                    padding: '12px 8px',
                                  }}
                                >
                                  <PlayerStatsTable
                                    title={getTeamName(game.away_team_id)}
                                    stats={awayStats}
                                    formatMin={formatMin}
                                    fgPct={fgPct}
                                  />
                                  <PlayerStatsTable
                                    title={getTeamName(game.home_team_id)}
                                    stats={homeStats}
                                    formatMin={formatMin}
                                    fgPct={fgPct}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && selectedTeam && games.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>No games found for this team and season.</p>
      )}

      {!selectedTeam && (
        <p style={{ color: 'var(--muted)' }}>Select a season and team to get started.</p>
      )}
    </main>
  )
}

function Badge({ yes, label }: { yes: boolean; label?: string }) {
  return (
    <span style={{
      background: yes ? '#e8f5e9' : '#ffebee',
      color: yes ? '#2e7d32' : '#c62828',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {label ?? (yes ? 'Yes' : 'No')}
    </span>
  )
}

function CoverBadge({ result }: { result: string | null }) {
  const isCovered = result === 'covered'
  const isMissed = result === 'missed'
  const isPush = result === 'push'

  return (
    <span
      style={{
        background: isCovered
          ? '#e8f5e9'
          : isMissed
            ? '#ffebee'
            : '#f3f4f6',
        color: isCovered
          ? '#2e7d32'
          : isMissed
            ? '#c62828'
            : '#666',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {isCovered ? 'Covered' : isMissed ? 'Missed' : isPush ? 'Push' : '—'}
    </span>
  )
}

function PlayerStatsTable({
  title,
  stats,
  formatMin,
  fgPct,
}: {
  title: string
  stats: PlayerStat[]
  formatMin: (min: string) => string
  fgPct: (made: number, att: number) => string
}) {
  const sorted = [...stats].sort((a, b) => b.pts - a.pts)

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, opacity: 0.9, paddingBottom: 4, color: 'var(--text)' }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--table-header)' }}>
            <th style={sth}>Player</th>
            {/* <th style={sth}>Pos</th> */}
            <th style={sth}>Min</th>
            <th style={sth}>Pts</th>
            <th style={sth}>Reb</th>
            <th style={sth}>Ast</th>
            <th style={sth}>Stl</th>
            <th style={sth}>Blk</th>
            <th style={sth}>FG</th>
            <th style={sth}>3P</th>
            <th style={sth}>FT</th>
            <th style={sth}>TO</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={std}>
                {s.player
                  ? `${s.player.first_name[0]}. ${s.player.last_name}`
                  : `Player ${s.player_id}`}
              </td>
              {/* <td style={{ ...std, color: 'var(--muted)' }}>{s.player?.position ?? '—'}</td> */}
              <td style={std}>{formatMin(s.min)}</td>
              <td style={{ ...std, fontWeight: 600 }}>{s.pts}</td>
              <td style={std}>{s.reb}</td>
              <td style={std}>{s.ast}</td>
              <td style={std}>{s.stl}</td>
              <td style={std}>{s.blk}</td>
              <td style={std}>{fgPct(s.fgm, s.fga)}</td>
              <td style={std}>{fgPct(s.fg3m, s.fg3a)}</td>
              <td style={std}>{fgPct(s.ftm, s.fta)}</td>
              <td style={std}>{s.turnover}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 14,
  background: 'var(--card)',
  color: 'var(--text)',
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  color: 'var(--text)',
}

const sth: React.CSSProperties = {
  padding: '6px 8px',
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--muted)',
  textAlign: 'left',
}

const std: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--text)',
}
