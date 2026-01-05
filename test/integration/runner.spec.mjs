import process from 'node:process'

const tasks = [
  () => import('../../tools/lv-images/pipeline.spec.mjs').then((mod) => mod.run?.()),
  () => import('./ci-correction.spec.mjs').then((mod) => mod.run?.()),
]

let failures = 0

for (const task of tasks) {
  try {
    await task()
  } catch (error) {
    failures++
    console.error(error)
  }
}

if (failures) {
  process.exitCode = 1
} else {
  console.log('integration runner ✅')
}
