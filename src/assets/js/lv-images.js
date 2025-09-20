import init from '@/content/projects/lv-images/client.js'

const boot = () => {
  try {
    init()
  } catch (error) {
    console.error('[lv-images] init failed', error)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
