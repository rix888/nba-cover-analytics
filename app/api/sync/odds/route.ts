import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export const maxDuration = 60

const ODDS_API_KEY = process.env.ODDS_API_KEY

const REGIONS = 'us'
const ODDS_FORMAT = 'american'
const MARKETS = ['spreads', 'spreads_h1', 'spreads_q1']

const BOOKMAKER_KEY = 'draftkings'

function getEasternDate(isoDate: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoDate))
}

export async function GET() {
  try {
    if (!ODDS_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing ODDS_API_KEY' },
        { status: 500 }
      )
    }

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, city, name, abbreviation')

    if (teamsError) {
      return NextResponse.json(
        { success: false, error: teamsError.message },
        { status: 500 }
      )
    }

    const teamIdByFullName: Record<string, number> = {}

    for (const team of teams ?? []) {
      teamIdByFullName[`${team.city} ${team.name}`] = team.id
    }

    const eventsUrl =
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds` +
      `?apiKey=${ODDS_API_KEY}` +
      `&regions=${REGIONS}` +
      `&markets=spreads` +
      `&oddsFormat=${ODDS_FORMAT}`

    const eventsRes = await fetch(eventsUrl, { cache: 'no-store' })
    const events = await eventsRes.json()

    if (!eventsRes.ok) {
      return NextResponse.json(
        { success: false, error: events },
        { status: eventsRes.status }
      )
    }

    let totalOdds = 0
    let matchedGames = 0

    for (const event of events ?? []) {
      const eventDate = event.commence_time
      ? getEasternDate(event.commence_time)
      : null
      const homeTeamId = teamIdByFullName[event.home_team]
      const awayTeamId = teamIdByFullName[event.away_team]

      if (!eventDate || !homeTeamId || !awayTeamId) {
        console.error('Could not map odds event to teams:', {
          eventDate,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          homeTeamId,
          awayTeamId,
        })
        continue
      }

      const { data: matchedGame, error: gameError } = await supabase
        .from('games')
        .select('id, nba_game_id')
        .eq('date', eventDate)
        .eq('home_team_id', homeTeamId)
        .eq('away_team_id', awayTeamId)
        .maybeSingle()

      if (gameError) {
        console.error('Game match error:', gameError.message)
        continue
      }

      if (!matchedGame) {
        console.error('No matching game found for odds event:', {
          eventDate,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
        })
        continue
      }

      matchedGames++

      const eventOddsUrl =
        `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${event.id}/odds` +
        `?apiKey=${ODDS_API_KEY}` +
        `&regions=${REGIONS}` +
        `&markets=${MARKETS.join(',')}` +
        `&oddsFormat=${ODDS_FORMAT}` +
        `&bookmakers=${BOOKMAKER_KEY}`

      const eventOddsRes = await fetch(eventOddsUrl, { cache: 'no-store' })
      const eventOdds = await eventOddsRes.json()

      if (!eventOddsRes.ok) {
        console.error('Event odds error:', eventOdds)
        continue
      }

      const bookmaker = eventOdds.bookmakers?.find(
        (b: any) => b.key === BOOKMAKER_KEY
      )

      if (!bookmaker) continue

      const oddsToInsert: any[] = []

      for (const market of bookmaker.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          oddsToInsert.push({
            game_id: matchedGame.id,
            nba_game_id: matchedGame.nba_game_id,
            market_key: market.key,
            bookmaker: bookmaker.title,
            team_name: outcome.name,
            team_id: teamIdByFullName[outcome.name] ?? null,
            point: outcome.point,
            price: outcome.price,
            commence_time: eventOdds.commence_time,
          })
        }
      }

      if (oddsToInsert.length === 0) continue

      const { error: oddsError } = await supabase
        .from('game_odds')
        .insert(oddsToInsert)

      if (oddsError) {
        console.error('Odds insert error:', oddsError.message)
        continue
      }

      totalOdds += oddsToInsert.length
    }

    return NextResponse.json({
      success: true,
      events: events.length,
      matchedGames,
      oddsInserted: totalOdds,
      bookmaker: BOOKMAKER_KEY,
      markets: MARKETS,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}