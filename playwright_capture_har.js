const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: 'har_capture.har' }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));

  console.log('Navigating to http://localhost:3000 ...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error('Navigation error:', e.message || e);
  }

  // Wait for XHRs to fire
  await page.waitForTimeout(4000);

  await context.close();
  await browser.close();
  console.log('Wrote har_capture.har');
})();
