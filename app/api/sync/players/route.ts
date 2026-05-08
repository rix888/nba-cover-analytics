import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { fetchNBABoxscore } from '@/lib/balldontlie'

export const maxDuration = 60

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET() {
  try {
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, nba_game_id')
      .eq('status', 'Final')
      .not('nba_game_id', 'is', null)
      .order('id', { ascending: false })
      .limit(50)

    if (gamesError) {
      return NextResponse.json(
        { success: false, error: gamesError.message },
        { status: 500 }
      )
    }

    let totalPlayers = 0

    for (const game of games ?? []) {
      const boxscore = await fetchNBABoxscore(game.nba_game_id)
      if (!boxscore) continue

      const allPlayers = [
        ...(boxscore.homeTeam?.players ?? []),
        ...(boxscore.awayTeam?.players ?? []),
      ]

      if (allPlayers.length === 0) continue

      const playersToInsert = allPlayers.map((p: any) => ({
        id: p.personId, // ✅ THIS IS THE FIX
        first_name: p.firstName ?? '',
        last_name: p.familyName ?? '',
        position: p.position ?? '',
        team_id: null, // optional for now
      }))

      const { error } = await supabase
        .from('players')
        .upsert(playersToInsert, { onConflict: 'id' })

      if (error) {
        console.error(`Player sync error for game ${game.id}: ${error.message}`)
        continue
      }

      totalPlayers += playersToInsert.length

      await sleep(500)
    }

    return NextResponse.json({ success: true, players: totalPlayers })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}