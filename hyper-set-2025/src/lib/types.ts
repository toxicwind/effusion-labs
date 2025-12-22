export type Track = {
  id: number
  urn: string
  title: string
  duration: number
  artwork_url?: string
  user: { id: number; username: string }
  likes_count: number
}

export type AudioFeatures = {
  bpm: number | null
  key: string | null
  scale: string | null
  energy: number | null
  danceability: number | null
}

export type GraphNode = {
  id: string
  type: 'seed' | 'playlist' | 'digger'
  data: { label: string }
  position: { x: number; y: number }
}

export type CrawlResult = {
  track: Track
  context: any
}