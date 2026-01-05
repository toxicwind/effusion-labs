// src/assets/js/app.js
// Entry point: hydrate global scripts for Eleventy pages.

import '@/assets/css/app.css'
import 'iconify-icon'
import './theme-utils.js'
import { bootSite, onReady } from './site-init.js'

onReady(() => {
  bootSite()
})
