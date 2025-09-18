// src/assets/js/theme-toggle.js
// Dedicated entry for pages that only need the theme toggle affordance.

import './theme-utils.js'
import { onReady, initThemeToggle } from './site-init.js'

onReady(() => {
  initThemeToggle()
})
