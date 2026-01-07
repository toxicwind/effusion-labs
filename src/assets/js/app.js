// src/assets/js/app.js
// Entry point: hydrate global scripts for Eleventy pages.

// import '@/assets/css/app.css' // Temporarily disabled for stabilization
import 'iconify-icon'
// import './canvas-overlay.jsx' // Temporarily disabled for stabilization
import './theme-utils.js'
import { bootSite, onReady } from './site-init.js'

onReady(() => {
  bootSite()

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW registered:', reg)
      }).catch(err => {
        console.log('SW registration failed:', err)
      })
    })
  }
})
