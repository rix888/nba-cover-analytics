import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { fetchGamesForSeason, fetchNBASchedule } from '@/lib/balldontlie'

export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const season = parseInt(searchParams.get('season') ?? '2025')
    const postseasonOnly = searchParams.get('postseason') === 'true'

    const nbaSeason = season === 2025 ? '2025-26' : '2024-25'

    const [allGames, nbaSchedule, teamsData] = await Promise.all([
      fetchGamesForSeason(season),
      fetchNBASchedule(nbaSeason),
      supabase.from('teams').select('id, abbreviation'),
    ])

    if (teamsData.error) {
      throw new Error(teamsData.error.message)
    }

    const teamMap: Record<number, string> = {}

    for (const team of teamsData.data ?? []) {
      teamMap[team.id] = team.abbreviation
    }

    const nbaGameIdMap: Record<string, string> = {}

    for (const game of nbaSchedule ?? []) {
      const date = game.gameDateEst?.slice(0, 10)
      const homeAbbr = game.homeTeam?.teamTricode

      if (!date || !homeAbbr) continue

      const key = `${date}_${homeAbbr}`
      nbaGameIdMap[key] = game.gameId
    }

    const games = postseasonOnly
      ? allGames.filter((game: any) => game.postseason === true)
      : allGames

    const gamesToUpsert = games.map((g: any) => {
      const date = g.date?.slice(0, 10)
      const homeAbbr = teamMap[g.home_team.id]
      const nbaGameId =
        date && homeAbbr ? nbaGameIdMap[`${date}_${homeAbbr}`] : null

      return {
        id: g.id,
        date: g.date,
        season: g.season,
        status: g.status,
        postseason: g.postseason ?? false,
        nba_game_id: nbaGameId ?? null,
        home_team_id: g.home_team.id,
        away_team_id: g.visitor_team.id,
        home_q1: g.home_q1 ?? 0,
        home_q2: g.home_q2 ?? 0,
        home_q3: g.home_q3 ?? 0,
        home_q4: g.home_q4 ?? 0,
        away_q1: g.visitor_q1 ?? 0,
        away_q2: g.visitor_q2 ?? 0,
        away_q3: g.visitor_q3 ?? 0,
        away_q4: g.visitor_q4 ?? 0,
        home_final: g.home_team_score ?? 0,
        away_final: g.visitor_team_score ?? 0,
        datetime: g.datetime ?? g.date,
      }
    })

    if (gamesToUpsert.length === 0) {
      return NextResponse.json({
        success: true,
        season,
        postseasonOnly,
        games: 0,
        matched: 0,
      })
    }

    const { error } = await supabase
      .from('games')
      .upsert(gamesToUpsert, { onConflict: 'id' })

    if (error) {
      throw new Error(error.message)
    }

    const matched = gamesToUpsert.filter(game => game.nba_game_id).length

    return NextResponse.json({
      success: true,
      season,
      postseasonOnly,
      games: gamesToUpsert.length,
      matched,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}