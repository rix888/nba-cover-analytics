import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Official 30 NBA team IDs — filters out any G-League or non-NBA teams
const NBA_TEAM_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30
]

export async function GET() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .in('id', NBA_TEAM_IDS)
    .order('city', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}