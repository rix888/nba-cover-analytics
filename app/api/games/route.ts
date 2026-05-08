import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('team_id')
  const season = searchParams.get('season')
  const seasonType = searchParams.get('season_type') ?? 'regular'

  let query = supabase
    .from('games')
    .select('*')
    .order('date', { ascending: false })

  if (season) query = query.eq('season', parseInt(season))

  if (seasonType === 'playoffs') {
    query = query.eq('postseason', true)
  } else {
    query = query.eq('postseason', false)
  }

  if (teamId) {
    query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}