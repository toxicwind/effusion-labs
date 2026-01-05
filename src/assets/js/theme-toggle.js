// src/assets/js/theme-toggle.js
// Dedicated entry for pages that only need the theme toggle affordance.

import './theme-utils.js'
import { initThemeToggle, onReady } from './site-init.js'

onReady(() => {
  initThemeToggle()
})
