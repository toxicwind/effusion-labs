export default async function probe() {
  try {
    await import('playwright-core');
    return { browser: true, reason: '' };
  } catch (err) {
    return { browser: false, reason: err.message };
  }
}
