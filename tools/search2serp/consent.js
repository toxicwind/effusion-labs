async function acceptConsent(page){
  const selectors = [
    'button:has-text("I agree")',
    '#L2AGLb',
    'button[aria-label="Accept all"]',
    'form[action*="consent"] button:nth-of-type(2)'
  ];
  for(const sel of selectors){
    const btn = page.locator(sel).first();
    try{
      if(await btn.isVisible({ timeout:1000 })){
        await btn.click();
        return true;
      }
    }catch{}
  }
  return false;
}

module.exports = { acceptConsent };
