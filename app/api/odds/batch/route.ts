import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const { gameIds } = await request.json()

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase
    .from('game_odds')
    .select('*')
    .in('game_id', gameIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}