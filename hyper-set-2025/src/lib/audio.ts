import type { AudioFeatures } from './types'

export async function analyzeFromStream(): Promise<AudioFeatures> {
  return { bpm: 120, key: 'C', scale: 'minor', energy: 0.5, danceability: 0.6 }
}

export function calculateDropTime(comments: any[]): number | null {
  return null
}