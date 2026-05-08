export type Team = {
    id: number
    name: string
    abbreviation: string
    city: string
    conference: string
    division: string
}
  
export type Player = {
    id: number
    first_name: string
    last_name: string
    position: string
    team_id: number
}
  
export type Game = {
    id: number
    date: string
    season: number
    status: string
    home_team_id: number
    away_team_id: number
    home_q1: number
    home_q2: number
    home_q3: number
    home_q4: number
    away_q1: number
    away_q2: number
    away_q3: number
    away_q4: number
    home_final: number
    away_final: number
    datetime: string
}
  
export type PlayerStat = {
    id: number
    game_id: number
    player_id: number
    team_id: number
    pts: number
    reb: number
    ast: number
    stl: number
    blk: number
    min: string
    fgm: number
    fga: number
    fg3m: number
    fg3a: number
    ftm: number
    fta: number
    turnover: number
}