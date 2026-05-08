import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  let allPlayers: any[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, first_name, last_name, position')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) break

    allPlayers = allPlayers.concat(data)

    if (data.length < pageSize) break

    from += pageSize
  }

  return NextResponse.json(allPlayers)
}