'use client'

import { useState } from 'react'

interface SeedDashboardProps {
  onBack: () => void
}

export default function SeedDashboard({ onBack }: SeedDashboardProps) {
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  return (
    <div className="h-screen flex bg-hyper-dark text-white">
      <div className="flex-1"></div>
      <div className="w-96 bg-gradient-to-b from-neutral-900 to-hyper-dark border-l border-neutral-800 p-6">
        <button onClick={onBack} className="mb-6">← Back</button>
        <div className="space-y-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://soundcloud.com/artist/track"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
          />
          <button
            disabled={analyzing}
            className="w-full bg-hyper-green text-black font-bold py-2 rounded hover:bg-cyan-400"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Track'}
          </button>
        </div>
      </div>
    </div>
  )
}