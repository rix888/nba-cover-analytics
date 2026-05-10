import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    if (!baseUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing NEXT_PUBLIC_BASE_URL' },
        { status: 500 }
      )
    }

    const endpoints = [
      '/api/sync/games',
      '/api/sync/odds',
      '/api/sync/stats',
    ]

    const results = []

    for (const endpoint of endpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        cache: 'no-store',
      })

      let body: unknown = null

      try {
        body = await res.json()
      } catch {
        body = await res.text()
      }

      results.push({
        endpoint,
        ok: res.ok,
        status: res.status,
        body,
      })
    }

    return NextResponse.json({
      success: results.every(result => result.ok),
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}