const API_KEY = process.env.BALLDONTLIE_API_KEY!
const BASE_URL = 'https://api.balldontlie.io/v1'

const headers = {
  Authorization: API_KEY,
}

export async function fetchAllTeams() {
    while (true) {
      const res = await fetch(`${BASE_URL}/teams?per_page=100`, { headers })
      if (res.status === 429) {
        console.log('Rate limited on teams, waiting 10 seconds...')
        await sleep(10000)
        continue
      }
      const data = await res.json()
      return data.data
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function fetchGamesForSeason(season: number) {
  let allGames: any[] = []
  let cursor = 0
  let hasMore = true

  while (hasMore) {
    const url = `${BASE_URL}/games?seasons[]=${season}&per_page=100${cursor ? `&cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers })

    if (res.status === 429) {
      console.log('Rate limited, waiting 5 seconds...')
      await sleep(5000)
      continue
    }

    const data = await res.json()
    allGames = [...allGames, ...data.data]

    if (data.meta?.next_cursor) {
      cursor = data.meta.next_cursor
      await sleep(1000) // wait 1 second between pages
    } else {
      hasMore = false
    }
  }

  return allGames
}

export async function fetchPlayerStatsForGame(gameId: number) {
  const res = await fetch(
    `${BASE_URL}/stats?game_ids[]=${gameId}&per_page=100`,
    { headers }
  )
  const data = await res.json()
  return data.data
}

export async function fetchAllPlayers() {
    let allPlayers: any[] = []
    let cursor = 0
    let hasMore = true
  
    while (hasMore) {
      const url = `${BASE_URL}/players?per_page=100${cursor ? `&cursor=${cursor}` : ''}`
      const res = await fetch(url, { headers })
  
      if (res.status === 429) {
        console.log('Rate limited on players, waiting 5 seconds...')
        await sleep(5000)
        continue
      }
  
      const data = await res.json()
      allPlayers = [...allPlayers, ...data.data]
  
      if (data.meta?.next_cursor) {
        cursor = data.meta.next_cursor
        await sleep(1000)
      } else {
        hasMore = false
      }
    }
  
    return allPlayers
}

// NBA.com helpers — no API key needed
const NBA_CDN = 'https://cdn.nba.com/static/json/liveData'
const NBA_STATS = 'https://stats.nba.com/stats'

const nbaHeaders = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export async function fetchNBASchedule(season: string = '2024-25') {
    const url = `https://stats.nba.com/stats/scheduleleaguev2?Season=${season}&LeagueID=00`
    const res = await fetch(url, { headers: nbaHeaders })
  
    if (!res.ok) {
      throw new Error(`NBA schedule fetch failed: ${res.status}`)
    }
  
    const data = await res.json()
    const resultSet = data?.leagueSchedule?.gameDates ?? []
    const allGames: any[] = []
  
    for (const gameDate of resultSet) {
      for (const game of gameDate.games ?? []) {
        allGames.push(game)
      }
    }
  
    return allGames
}

export async function fetchNBABoxscore(nbaGameId: string) {
    const url = `${NBA_CDN}/boxscore/boxscore_${nbaGameId}.json`
  
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { headers: nbaHeaders })
        if (!res.ok) return null
        const data = await res.json()
        return data?.game ?? null
      } catch (err: any) {
        if (attempt < 3) {
          console.log(`Boxscore fetch failed for ${nbaGameId}, retrying in 3s...`)
          await sleep(3000)
        } else {
          console.error(`Boxscore fetch failed after 3 attempts for ${nbaGameId}`)
          return null
        }
      }
    }
  
    return null
}