
import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sparkles, Float, Stars } from '@react-three/drei'

function DataNodes() {
    const mesh = useRef()
    useFrame((state, delta) => {
        mesh.current.rotation.x += delta * 0.1
        mesh.current.rotation.y += delta * 0.15
    })

    return (
        <Float speed={2} rotationIntensity={1} floatIntensity={2}>
            <group ref={mesh}>
                <Sparkles count={100} scale={12} size={4} speed={0.4} opacity={0.5} color="#10b981" />
                <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
            </group>
        </Float>
    )
}

function Scene() {
    return (
        <Canvas camera={{ position: [0, 0, 10], fov: 45 }} gl={{ alpha: true, antialias: true }}>
            <ambientLight intensity={0.5} />
            <DataNodes />
        </Canvas>
    )
}

// Mount logic
const container = document.getElementById('react-overlay')
if (container) {
    const root = createRoot(container)
    root.render(<Scene />)
    console.log('⚡ React Fiber Overlay Mounted')
} else {
    console.error('React overlay container not found')
}
