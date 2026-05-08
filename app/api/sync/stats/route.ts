import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { fetchNBABoxscore } from '@/lib/balldontlie'

export const maxDuration = 60

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET() {
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, abbreviation')

    if (teamsError) {
      return NextResponse.json(
        { success: false, error: teamsError.message },
        { status: 500 }
      )
    }

    const teamIdByAbbr: Record<string, number> = {}

    for (const team of teams ?? []) {
      if (team.abbreviation) {
        teamIdByAbbr[team.abbreviation] = team.id
      }
    }

    const { data: completedGames, error: gamesError } = await supabase
      .from('games')
      .select('id, nba_game_id')
      .eq('status', 'Final')
      .eq('season', 2025)
      .eq('postseason', true)
      .not('nba_game_id', 'is', null)
      .order('id', { ascending: true })
    
    if (gamesError) {
      return NextResponse.json(
        { success: false, error: gamesError.message },
        { status: 500 }
      )
    }

    let totalStats = 0

    for (const game of completedGames ?? []) {
      console.log(`Processing game.id=${game.id}, nba_game_id=${game.nba_game_id}`)
      
      const boxscore = await fetchNBABoxscore(game.nba_game_id)
      
      if (!boxscore) {
        console.error(`No boxscore for game.id=${game.id}, nba_game_id=${game.nba_game_id}`)
        continue
      }

      const homePlayers = boxscore.homeTeam?.players ?? []
      const awayPlayers = boxscore.awayTeam?.players ?? []
      const allPlayers = [...homePlayers, ...awayPlayers]

      if (allPlayers.length === 0) continue

      const homeAbbr = boxscore.homeTeam?.teamTricode
      const awayAbbr = boxscore.awayTeam?.teamTricode

      const mappedHomeTeamId = homeAbbr ? teamIdByAbbr[homeAbbr] : undefined
      const mappedAwayTeamId = awayAbbr ? teamIdByAbbr[awayAbbr] : undefined

      if (!mappedHomeTeamId || !mappedAwayTeamId) {
        console.error(
          `Team mapping failed for game ${game.id}. home=${homeAbbr}, away=${awayAbbr}`
        )
        continue
      }

      const homePlayerIds = new Set(
        homePlayers.map((p: any) => String(p.personId))
      )

      const statsToInsert = allPlayers
        .filter((p: any) => p.statistics?.minutesCalculated !== 'PT00M')
        .map((p: any) => {
          const isHomePlayer = homePlayerIds.has(String(p.personId))

          return {
            id: parseInt(`${game.id}${p.personId}`),
            game_id: game.id,
            player_id: p.personId,
            team_id: isHomePlayer ? mappedHomeTeamId : mappedAwayTeamId,
            pts: p.statistics?.points ?? 0,
            reb: p.statistics?.reboundsTotal ?? 0,
            ast: p.statistics?.assists ?? 0,
            stl: p.statistics?.steals ?? 0,
            blk: p.statistics?.blocks ?? 0,
            min: p.statistics?.minutesCalculated ?? '0',
            fgm: p.statistics?.fieldGoalsMade ?? 0,
            fga: p.statistics?.fieldGoalsAttempted ?? 0,
            fg3m: p.statistics?.threePointersMade ?? 0,
            fg3a: p.statistics?.threePointersAttempted ?? 0,
            ftm: p.statistics?.freeThrowsMade ?? 0,
            fta: p.statistics?.freeThrowsAttempted ?? 0,
            turnover: p.statistics?.turnovers ?? 0,
          }
        })

      if (statsToInsert.length === 0) {
          console.error(`No player stats to insert for game.id=${game.id}, nba_game_id=${game.nba_game_id}`)
          continue
      }

      const { error } = await supabase
        .from('player_stats')
        .upsert(statsToInsert, { onConflict: 'id' })

      if (error) {
        console.error(`Stats error for game ${game.id}: ${error.message}`)
        continue
      }

      totalStats += statsToInsert.length
      console.log(
        `Game ${game.id} done — ${statsToInsert.length} players | total so far: ${totalStats}`
      )

      await sleep(1000)
    }

    return NextResponse.json({ success: true, playerStats: totalStats })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}