'use client'

import { useState } from 'react'
import SeedDashboard from '@/components/SeedDashboard'

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) return <SeedDashboard onBack={() => setShowDashboard(false)} />

  return (
    <div className="min-h-screen bg-hyper-dark text-white flex flex-col items-center justify-center">
      <h1 className="text-6xl font-black mb-4 text-hyper-green">HYPER-SET</h1>
      <p className="text-lg text-gray-400 mb-8">Algorithmic DJ Set Generator</p>
      <button
        onClick={() => setShowDashboard(true)}
        className="px-8 py-3 bg-hyper-green text-black font-bold rounded hover:bg-cyan-400 transition"
      >
        Launch Dashboard
      </button>
    </div>
  )
}