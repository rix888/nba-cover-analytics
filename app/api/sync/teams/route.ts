import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { fetchAllTeams } from '@/lib/balldontlie'

export const maxDuration = 60

export async function GET() {
  try {
    const teams = await fetchAllTeams()
    const { error } = await supabase
      .from('teams')
      .upsert(
        teams.map((t: any) => ({
          id: t.id,
          name: t.name,
          abbreviation: t.abbreviation,
          city: t.city,
          conference: t.conference,
          division: t.division,
        })),
        { onConflict: 'id' }
      )
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, count: teams.length })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}