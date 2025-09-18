// src/assets/js/app.js
// Entry point: hydrate global scripts for Eleventy pages.

import '@/assets/css/app.css'
import './theme-utils.js'
import { onReady, bootSite } from './site-init.js'

onReady(() => {
  bootSite()
})
