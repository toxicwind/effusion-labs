import type { Track, CrawlResult } from './types'

const SC_API = 'https://api-v2.soundcloud.com'
const CLIENT_ID = process.env.NEXT_PUBLIC_SC_CLIENT_ID

export async function omniCrawl(trackUrl: string): Promise<CrawlResult | null> {
  try {
    const response = await fetch(`${SC_API}/resolve?url=${trackUrl}&client_id=${CLIENT_ID}`)
    const track = await response.json() as Track
    return { track, context: {} }
  } catch {
    return null
  }
}