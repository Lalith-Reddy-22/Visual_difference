const express = require('express');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

const DEFAULT_CONFIG = {
  threshold: 0.1,
  failThreshold: 0.1,
  viewports: [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ],
  tests: [],
};

router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT config FROM configs WHERE user_id = $1', [req.user.id]);
    res.json(rows[0]?.config ?? DEFAULT_CONFIG);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { threshold, failThreshold, viewports, tests } = req.body;
    const config = { threshold, failThreshold, viewports, tests };
    await pool.query(
      'INSERT INTO configs (user_id, config) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET config = $2',
      [req.user.id, config]
    );
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/crawl', authenticate, async (req, res) => {
  const { baseUrl } = req.body;
  if (!baseUrl) return res.status(400).json({ error: 'baseUrl required' });

  let browser;
  try {
    const { chromium } = require('playwright');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const origin = new URL(baseUrl).origin;
    const visited = new Set();
    const queue = [baseUrl];
    const found = [];

    while (queue.length && found.length < 50) {
      const url = queue.shift();
      const normalized = url.split('#')[0].replace(/\/$/, '') || origin;
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      try {
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        } catch {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        const finalUrl = page.url();
        const normalizedFinal = finalUrl.split('#')[0].replace(/\/$/, '');
        if (found.some(f => f.url.replace(/\/$/, '') === normalizedFinal)) continue;

        const urlPath = new URL(finalUrl).pathname;
        const name = urlPath === '/' ? 'home' : urlPath.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/-$/, '').toLowerCase() || 'page';
        found.push({ name, url: finalUrl });

        const links = await page.$$eval('a[href]', els =>
          els.map(a => a.href).filter(h => h.startsWith('http'))
        );
        for (const link of links) {
          const clean = link.split('#')[0].replace(/\/$/, '');
          if (clean.startsWith(origin) && !visited.has(clean)) queue.push(clean);
        }
      } catch { /* skip unreachable pages */ }
    }

    await browser.close();
    res.json({ pages: found });
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
