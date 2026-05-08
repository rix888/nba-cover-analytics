import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('game_id')
  const playerId = searchParams.get('player_id')
  const teamId = searchParams.get('team_id')

  let query = supabase
    .from('player_stats')
    .select('*')

  if (gameId) query = query.eq('game_id', parseInt(gameId))
  if (playerId) query = query.eq('player_id', parseInt(playerId))
  if (teamId) query = query.eq('team_id', parseInt(teamId))

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}