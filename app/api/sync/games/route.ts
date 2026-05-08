import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { fetchGamesForSeason, fetchNBASchedule } from '@/lib/balldontlie'

export const maxDuration = 60

export async function GET() {
  try {
    const [games2024, games2025] = await Promise.all([
        fetchGamesForSeason(2024),
        fetchGamesForSeason(2025),
      ])
    const games = [...games2024, ...games2025]
    const { error } = await supabase
      .from('games')
      .upsert(
        games.map((g: any) => ({
          id: g.id,
          date: g.date,
          season: g.season,
          status: g.status,
          postseason: g.postseason ?? false,
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
        })),
        { onConflict: 'id' }
      )
    if (error) throw new Error(error.message)

    // Match NBA game IDs
    const [schedule2024, schedule2025] = await Promise.all([
        fetchNBASchedule('2024-25'),
        fetchNBASchedule('2025-26'),
      ])
    const nbaSchedule = [...schedule2024, ...schedule2025]
    const nbaGameIdMap: Record<string, string> = {}
    for (const g of nbaSchedule) {
      const date = g.gameDateEst?.slice(0, 10)
      const key = `${date}_${g.homeTeam?.teamTricode}`
      nbaGameIdMap[key] = g.gameId
    }

    const teamsData = await supabase.from('teams').select('id, abbreviation')
    const teamMap: Record<number, string> = {}
    for (const t of teamsData.data ?? []) {
      teamMap[t.id] = t.abbreviation
    }

    let matched = 0
    for (const g of games) {
      const key = `${g.date?.slice(0, 10)}_${teamMap[g.home_team.id]}`
      const nbaGameId = nbaGameIdMap[key]
      if (nbaGameId) {
        await supabase.from('games').update({ nba_game_id: nbaGameId }).eq('id', g.id)
        matched++
      }
    }

    return NextResponse.json({ success: true, games: games.length, matched })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}