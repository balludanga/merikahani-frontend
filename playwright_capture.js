const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = { console: [], requests: [], responses: [], failed: [] };

  page.on('console', msg => {
    try {
      logs.console.push({ type: msg.type(), text: msg.text(), location: msg.location() });
    } catch (e) {
      logs.console.push({ type: 'unknown', text: String(msg) });
    }
  });

  page.on('request', req => {
    logs.requests.push({ url: req.url(), method: req.method(), headers: req.headers(), resourceType: req.resourceType() });
  });

  page.on('response', async res => {
    try {
      const req = res.request();
      logs.responses.push({ url: res.url(), status: res.status(), headers: res.headers(), request: { url: req.url(), method: req.method() } });
    } catch (e) {
      logs.responses.push({ url: res.url(), status: res.status() });
    }
  });

  page.on('requestfailed', req => {
    const f = req.failure();
    logs.failed.push({ url: req.url(), failure: f ? f.errorText : null });
  });

  console.log('Navigating to http://localhost:3000 ...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error('Navigation error:', e.message || e);
  }

  // Wait a bit for background XHR/fetch to fire
  await page.waitForTimeout(4000);

  // Snapshot of requests that include /api/posts
  const posts = logs.requests.filter(r => r.url.includes('/api/posts'));

  await fs.promises.writeFile('playwright_capture.json', JSON.stringify({ logs, posts }, null, 2));
  console.log('Wrote playwright_capture.json');

  await browser.close();
})();
