const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PNG } = require('pngjs');
const sharp = require('sharp');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();
const UPLOADS = path.join(__dirname, '../uploads');

let pixelmatch;
try { const pm = require('pixelmatch'); pixelmatch = pm.default || pm; } catch { pixelmatch = null; }

const DEFAULT_CONFIG = {
  threshold: 0.1,
  failThreshold: 0.1,
  viewports: [{ name: 'desktop', width: 1280, height: 720 }],
  tests: [],
};

async function getConfig(userId) {
  const { rows } = await pool.query('SELECT config FROM configs WHERE user_id = $1', [userId]);
  return rows[0]?.config ?? DEFAULT_CONFIG;
}

async function recordSnapshot(userId, runId, type, pageName, viewport, filePath, urlPath, width, height) {
  await pool.query(
    `INSERT INTO snapshots (run_id, user_id, type, page_name, viewport, file_path, url_path, width, height)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [runId, userId, type, pageName, viewport, filePath, urlPath, width ?? null, height ?? null]
  );
}

async function compareImages(baselinePath, snapshotPath, diffPath, options = {}) {
  const { threshold = 0.1, failThreshold = 0.1 } = options;
  const baselineRaw = await sharp(baselinePath).png().toBuffer();
  const snapshotRaw = await sharp(snapshotPath).png().toBuffer();
  const baselinePNG = PNG.sync.read(baselineRaw);
  let snapshotPNG = PNG.sync.read(snapshotRaw);
  if (baselinePNG.width !== snapshotPNG.width || baselinePNG.height !== snapshotPNG.height) {
    const resized = await sharp(snapshotRaw)
      .resize(baselinePNG.width, baselinePNG.height, { fit: 'contain', background: '#ffffff' })
      .png().toBuffer();
    snapshotPNG = PNG.sync.read(resized);
  }
  const { width, height } = baselinePNG;
  const maskPNG = new PNG({ width, height });
  const numDiff = pixelmatch
    ? pixelmatch(baselinePNG.data, snapshotPNG.data, maskPNG.data, width, height, { threshold })
    : 0;
  const diffPercent = (numDiff / (width * height)) * 100;
  const passed = diffPercent <= failThreshold * 100;
  await fs.ensureDir(path.dirname(diffPath));

  if (numDiff > 0) {
    // Step 1: bucket diff pixels into a coarse grid
    // pixelmatch writes 255,0,0 for actual diff pixels — match only those
    const CELL = 4;
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const dirty = new Uint8Array(cols * rows);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (maskPNG.data[i] === 255 && maskPNG.data[i+1] === 0 && maskPNG.data[i+2] === 0)
          dirty[Math.floor(y / CELL) * cols + Math.floor(x / CELL)] = 1;
      }
    }

    // Step 2: BFS on dirty cells — only 4-connected (no diagonal), gap=0
    const visited = new Uint8Array(cols * rows);
    const rects = [];
    for (let bi = 0; bi < dirty.length; bi++) {
      if (!dirty[bi] || visited[bi]) continue;
      const queue = [bi];
      visited[bi] = 1;
      let minCx = cols, minCy = rows, maxCx = 0, maxCy = 0;
      while (queue.length) {
        const cur = queue.shift();
        const cx = cur % cols, cy = Math.floor(cur / cols);
        if (cx < minCx) minCx = cx;
        if (cy < minCy) minCy = cy;
        if (cx > maxCx) maxCx = cx;
        if (cy > maxCy) maxCy = cy;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (dirty[ni] && !visited[ni]) { visited[ni] = 1; queue.push(ni); }
        }
      }
      const PAD = 6;
      rects.push([
        Math.max(0, minCx * CELL - PAD),
        Math.max(0, minCy * CELL - PAD),
        Math.min(width - 1, (maxCx + 1) * CELL - 1 + PAD),
        Math.min(height - 1, (maxCy + 1) * CELL - 1 + PAD),
      ]);
    }

    // Step 3: copy production image, draw a red rectangle per cluster
    const diffPNG = new PNG({ width, height });
    baselinePNG.data.copy(diffPNG.data);
    const thick = Math.max(2, Math.round(Math.min(width, height) * 0.004));

    const drawRect = (x0, y0, x1, y1) => {
      for (let s = 0; s < thick; s++) {
        for (let x = x0; x <= x1; x++) {
          for (const y of [y0 + s, y1 - s]) {
            if (y < 0 || y >= height || x < 0 || x >= width) continue;
            const i = (y * width + x) * 4;
            diffPNG.data[i]=255; diffPNG.data[i+1]=0; diffPNG.data[i+2]=0; diffPNG.data[i+3]=255;
          }
        }
        for (let y = y0; y <= y1; y++) {
          for (const x of [x0 + s, x1 - s]) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const i = (y * width + x) * 4;
            diffPNG.data[i]=255; diffPNG.data[i+1]=0; diffPNG.data[i+2]=0; diffPNG.data[i+3]=255;
          }
        }
      }
    };

    for (const [x0, y0, x1, y1] of rects) drawRect(x0, y0, x1, y1);
    await fs.writeFile(diffPath, PNG.sync.write(diffPNG));
  } else {
    await fs.copyFile(baselinePath, diffPath);
  }

  return { passed, diffPercent: +diffPercent.toFixed(4), numDiff, width, height };
}

async function dismissPopups(page) {
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
  await page.evaluate(() => {
    const killSelectors = [
      '#onetrust-banner-sdk', '#onetrust-consent-sdk', '#cookiebanner', '#cookie-banner',
      '#cookie-notice', '#cookie-law-info-bar', '#gdpr-cookie-notice', '#gdpr-banner',
      '#consent-banner', '.cookie-banner', '.cookie-notice', '.cookie-bar', '.cookie-popup',
      '.cc-window', '.cc-banner', '.cc-overlay', '.modal', '.modal-backdrop', '.modal-overlay',
      '.overlay', '.popup', '.popup-overlay', '[class*="cookie"]', '[class*="consent"]',
      '[class*="gdpr"]', '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]',
      '[class*="modal"]', '[class*="popup"]', '[class*="overlay"]',
    ];
    killSelectors.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
    });
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    document.documentElement.style.removeProperty('overflow');
    document.querySelectorAll('*').forEach(el => {
      try {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex) || 0;
        const pos = s.position;
        if ((pos === 'fixed' || pos === 'absolute' || pos === 'sticky') && z > 1) {
          const rect = el.getBoundingClientRect();
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || '';
          const isNav =
            tag === 'nav' || tag === 'header' ||
            role === 'navigation' || role === 'banner' ||
            el.closest('nav, header, [role="navigation"], [role="banner"]') !== null ||
            (rect.top <= 80 && rect.width > window.innerWidth * 0.5 && rect.height < 200);
          if (!isNav && rect.width > 50 && rect.height > 30)
            el.style.setProperty('display', 'none', 'important');
        }
      } catch {}
    });
  }).catch(() => {});

  const clickSelectors = [
    '#onetrust-accept-btn-handler', '[aria-label="Accept cookies"]', '[aria-label="Close"]',
    '[aria-label="Dismiss"]', 'button:has-text("Accept all")', 'button:has-text("Accept All")',
    'button:has-text("Accept cookies")', 'button:has-text("I Accept")', 'button:has-text("I agree")',
    'button:has-text("Got it")', 'button:has-text("Dismiss")', 'button:has-text("Close")',
    'button:has-text("Allow all")', 'button:has-text("No thanks")', 'button:has-text("Continue")',
  ];
  for (const sel of clickSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click({ timeout: 300, force: true });
        await page.waitForTimeout(200);
        break;
      }
    } catch {}
  }

  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      try {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex) || 0;
        if ((s.position === 'fixed' || s.position === 'absolute') && z > 1) {
          const rect = el.getBoundingClientRect();
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || '';
          const isNav =
            tag === 'nav' || tag === 'header' ||
            role === 'navigation' || role === 'banner' ||
            el.closest('nav, header, [role="navigation"], [role="banner"]') !== null ||
            (rect.top <= 80 && rect.width > window.innerWidth * 0.5 && rect.height < 200);
          if (!isNav && rect.width > 50 && rect.height > 30)
            el.style.setProperty('display', 'none', 'important');
        }
      } catch {}
    });
  }).catch(() => {});
}

async function appendResult(runId, result) {
  await pool.query(`
    UPDATE runs
    SET results = results || $1::jsonb,
        summary = jsonb_build_object(
          'total',  jsonb_array_length(results) + 1,
          'passed', (SELECT COUNT(*) FROM jsonb_array_elements(results || $1::jsonb) r WHERE (r->>'passed')::boolean),
          'failed', (SELECT COUNT(*) FROM jsonb_array_elements(results || $1::jsonb) r WHERE NOT (r->>'passed')::boolean)
        )
    WHERE run_id = $2
  `, [JSON.stringify([result]), runId]);
}

async function finalizeRun(runId) {
  await pool.query(`
    UPDATE runs
    SET status = 'done', finished_at = NOW(),
        summary = jsonb_build_object(
          'total',  jsonb_array_length(results),
          'passed', (SELECT COUNT(*) FROM jsonb_array_elements(results) r WHERE (r->>'passed')::boolean),
          'failed', (SELECT COUNT(*) FROM jsonb_array_elements(results) r WHERE NOT (r->>'passed')::boolean)
        )
    WHERE run_id = $1
  `, [runId]);
}

function rowToRun(row) {
  return {
    runId: row.run_id,
    userId: row.user_id,
    type: row.type,
    stagingUrl: row.staging_url,
    productionUrl: row.production_url,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    results: row.results,
    summary: row.summary,
  };
}

// GET /runs
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM runs WHERE user_id = $1 ORDER BY started_at DESC',
      [req.user.id]
    );
    res.json(rows.map(rowToRun));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /runs/:runId
router.get('/:runId', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM runs WHERE run_id = $1', [req.params.runId]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    res.json(rowToRun(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /runs/compare
router.post('/compare', authenticate, async (req, res) => {
  const { stagingUrl, productionUrl, paths, viewports: vpOverride, dismissPopups: shouldDismiss = true } = req.body;
  if (!stagingUrl || !productionUrl)
    return res.status(400).json({ error: 'stagingUrl and productionUrl required' });

  const config = await getConfig(req.user.id);
  const runId = uuidv4();
  await pool.query(
    `INSERT INTO runs (run_id, user_id, type, staging_url, production_url, status, started_at)
     VALUES ($1,$2,'compare',$3,$4,'running',NOW())`,
    [runId, req.user.id, stagingUrl, productionUrl]
  );
  res.json({ runId });

  (async () => {
    let browser;
    try {
      const { chromium } = require('playwright');
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    } catch { await finalizeRun(runId); return; }

    const allViewports = config.viewports || [{ name: 'desktop', width: 1280, height: 720 }];
    const viewports = vpOverride?.length
      ? allViewports.filter(v => vpOverride.includes(v.name))
      : allViewports;
    const testPaths = paths?.length ? paths : ['/'];
    const snapshotDir = path.join(UPLOADS, 'snapshots');
    const diffDir = path.join(UPLOADS, 'diffs');
    await fs.ensureDir(snapshotDir);
    await fs.ensureDir(diffDir);

    for (const p of testPaths) {
      const name = p === '/'
        ? 'home'
        : p.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'page';

      for (const vp of viewports) {
        const ts = Date.now();
        const stagingFile = `compare_staging_${name}_${vp.name}_${ts}.png`;
        const prodFile    = `compare_prod_${name}_${vp.name}_${ts}.png`;
        const diffFile    = `compare_diff_${name}_${vp.name}_${ts}.png`;
        const stagingPath = path.join(snapshotDir, stagingFile);
        const prodPath    = path.join(snapshotDir, prodFile);
        const diffPath    = path.join(diffDir, diffFile);

        const capture = async (baseUrl, outPath) => {
          const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
          const page = await ctx.newPage();
          try {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            const url = `${baseUrl.replace(/\/$/, '')}${p}`;
            try {
              await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            } catch {
              // fallback: domcontentloaded is enough for a screenshot
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
            await page.waitForTimeout(1500);
            if (shouldDismiss) await dismissPopups(page);
            await page.screenshot({ path: outPath, fullPage: true });
          } finally { await ctx.close(); }
        };

        try { await capture(stagingUrl, stagingPath); } catch (err) {
          await appendResult(runId, { name, path: p, viewport: vp.name, passed: false, error: `Staging: ${err.message}`, stagingUrl: null, productionUrl: null, diffUrl: null });
          continue;
        }
        try { await capture(productionUrl, prodPath); } catch (err) {
          await appendResult(runId, { name, path: p, viewport: vp.name, passed: false, error: `Production: ${err.message}`, stagingUrl: null, productionUrl: null, diffUrl: null });
          continue;
        }

        const cmp = await compareImages(prodPath, stagingPath, diffPath, {
          threshold: config.threshold || 0.1,
          failThreshold: config.failThreshold || 0.1,
        });

        const stagingUrl_ = `/uploads/snapshots/${stagingFile}`;
        const prodUrl_    = `/uploads/snapshots/${prodFile}`;
        const diffUrl_    = `/uploads/diffs/${diffFile}`;

        await recordSnapshot(req.user.id, runId, 'staging',    name, vp.name, stagingPath, stagingUrl_, vp.width, null);
        await recordSnapshot(req.user.id, runId, 'production', name, vp.name, prodPath,    prodUrl_,    vp.width, null);
        await recordSnapshot(req.user.id, runId, 'diff',       name, vp.name, diffPath,    diffUrl_,    cmp.width, cmp.height);

        await appendResult(runId, {
          name, path: p, viewport: vp.name,
          stagingUrl: stagingUrl_,
          productionUrl: prodUrl_,
          diffUrl: diffUrl_,
          ...cmp,
        });
      }
    }

    if (browser) await browser.close();
    await finalizeRun(runId);
  })();
});

// POST /runs/trigger
router.post('/trigger', authenticate, async (req, res) => {
  try {
    const config = await getConfig(req.user.id);
    const runId = uuidv4();
    await pool.query(
      `INSERT INTO runs (run_id, user_id, type, status, started_at) VALUES ($1,$2,'trigger','running',NOW())`,
      [runId, req.user.id]
    );
    res.json({ runId });

    (async () => {
      let browser;
      try {
        const { chromium } = require('playwright');
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
      } catch { await finalizeRun(runId); return; }

      const viewports = config.viewports || [{ name: 'desktop', width: 1280, height: 720 }];
      const tests = config.tests || [];
      const snapshotDir = path.join(UPLOADS, 'snapshots');
      await fs.ensureDir(snapshotDir);

      for (const test of tests) {
        const activeVPs = test.viewports?.length
          ? viewports.filter(v => test.viewports.includes(v.name))
          : viewports;

        for (const vp of activeVPs) {
          const filename     = `${test.name}_${vp.name}_${Date.now()}.png`;
          const snapshotPath = path.join(snapshotDir, filename);
          const snapshotUrl  = `/uploads/snapshots/${filename}`;

          try {
            const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
            const page = await ctx.newPage();
            try {
              await page.setViewportSize({ width: vp.width, height: vp.height });
              try {
                await page.goto(test.url, { waitUntil: 'load', timeout: 30000 });
              } catch {
                await page.goto(test.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              }
              await page.waitForTimeout(1500);
              if (test.waitMs) await page.waitForTimeout(test.waitMs);
              await dismissPopups(page);
              await page.screenshot({ path: snapshotPath, fullPage: true });
            } finally { await ctx.close(); }
          } catch (err) {
            await appendResult(runId, { name: test.name, viewport: vp.name, passed: false, error: err.message, snapshotUrl: null, diffUrl: null, isNew: false });
            continue;
          }

          await recordSnapshot(req.user.id, runId, 'snapshot', test.name, vp.name, snapshotPath, snapshotUrl, vp.width, null);

          const { rows: blRows } = await pool.query(
            'SELECT file_path FROM baselines WHERE user_id=$1 AND page_name=$2 AND viewport=$3',
            [req.user.id, test.name, vp.name]
          );

          const diffFilename = `${test.name}_${vp.name}_${Date.now()}_diff.png`;
          const diffPath     = path.join(UPLOADS, 'diffs', diffFilename);
          const diffUrl      = `/uploads/diffs/${diffFilename}`;

          let result = { passed: true, diffPercent: 0, isNew: false };

          if (blRows.length) {
            const cmp = await compareImages(blRows[0].file_path, snapshotPath, diffPath, {
              threshold: config.threshold,
              failThreshold: config.failThreshold,
            });
            await recordSnapshot(req.user.id, runId, 'diff', test.name, vp.name, diffPath, diffUrl, cmp.width, cmp.height);
            result = { ...cmp, diffUrl };
          } else {
            const baselineDir  = path.join(UPLOADS, 'baselines', req.user.id);
            await fs.ensureDir(baselineDir);
            const baselinePath = path.join(baselineDir, `${test.name}_${vp.name}.png`);
            await fs.copy(snapshotPath, baselinePath);
            const baselineUrl  = `/uploads/baselines/${req.user.id}/${test.name}_${vp.name}.png`;
            await pool.query(
              `INSERT INTO baselines (user_id, page_name, viewport, file_path, url_path)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (user_id, page_name, viewport) DO UPDATE
               SET file_path=$4, url_path=$5, approved_at=NOW()`,
              [req.user.id, test.name, vp.name, baselinePath, baselineUrl]
            );
            result.isNew = true;
          }

          await appendResult(runId, { name: test.name, viewport: vp.name, snapshotUrl, diffUrl: result.diffUrl || null, ...result });
        }
      }

      if (browser) await browser.close();
      await finalizeRun(runId);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /runs/:runId
router.delete('/:runId', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT user_id FROM runs WHERE run_id = $1', [req.params.runId]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const { rows: snapshots } = await pool.query(
      'SELECT file_path FROM snapshots WHERE run_id = $1',
      [req.params.runId]
    );

    await pool.query('DELETE FROM runs WHERE run_id = $1', [req.params.runId]);

    for (const snap of snapshots) {
      await fs.remove(snap.file_path).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /runs/:runId/finish
router.patch('/:runId/finish', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM runs WHERE run_id = $1', [req.params.runId]);
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    await finalizeRun(req.params.runId);
    const { rows: updated } = await pool.query('SELECT * FROM runs WHERE run_id = $1', [req.params.runId]);
    res.json(rowToRun(updated[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
