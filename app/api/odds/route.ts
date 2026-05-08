import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('game_id')

  if (!gameId) {
    return NextResponse.json(
      { error: 'Missing game_id' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('game_odds')
    .select('*')
    .eq('game_id', parseInt(gameId))
    .order('market_key', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}