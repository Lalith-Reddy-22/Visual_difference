const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { PNG } = require('pngjs');
const sharp = require('sharp');
const { authenticate } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();
const UPLOADS = path.join(__dirname, '../uploads');

let pixelmatch;
try { const pm = require('pixelmatch'); pixelmatch = pm.default || pm; } catch { pixelmatch = null; }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOADS, 'snapshots')),
  filename: (req, file, cb) => cb(null, `${req.body.name}_${req.body.viewport}_${Date.now()}.png`),
});
const upload = multer({ storage });

async function compareImages(baselinePath, snapshotPath, diffPath, options = {}) {
  const { threshold = 0.1, failThreshold = 0.01 } = options;
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
    // Bucket diff pixels into 4px cells, then BFS (4-connected) to cluster
    const CELL = 4, PAD = 6;
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const dirty = new Uint8Array(cols * rows);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (maskPNG.data[i] === 255 && maskPNG.data[i+1] === 0 && maskPNG.data[i+2] === 0)
          dirty[Math.floor(y / CELL) * cols + Math.floor(x / CELL)] = 1;
      }
    const vis = new Uint8Array(cols * rows);
    const rects = [];
    for (let bi = 0; bi < dirty.length; bi++) {
      if (!dirty[bi] || vis[bi]) continue;
      const q = [bi]; vis[bi] = 1;
      let x0 = cols, y0 = rows, x1 = 0, y1 = 0;
      while (q.length) {
        const c = q.shift(), cx = c % cols, cy = Math.floor(c / cols);
        if (cx < x0) x0 = cx; if (cy < y0) y0 = cy;
        if (cx > x1) x1 = cx; if (cy > y1) y1 = cy;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx+dx, ny = cy+dy;
          if (nx<0||nx>=cols||ny<0||ny>=rows) continue;
          const ni = ny*cols+nx;
          if (dirty[ni] && !vis[ni]) { vis[ni]=1; q.push(ni); }
        }
      }
      rects.push([
        Math.max(0, x0*CELL - PAD), Math.max(0, y0*CELL - PAD),
        Math.min(width-1, (x1+1)*CELL-1 + PAD), Math.min(height-1, (y1+1)*CELL-1 + PAD),
      ]);
    }
    const diffPNG = new PNG({ width, height });
    baselinePNG.data.copy(diffPNG.data);
    const thick = Math.max(2, Math.round(Math.min(width, height) * 0.004));
    const drawRect = (rx0, ry0, rx1, ry1) => {
      for (let s = 0; s < thick; s++) {
        for (let x = rx0; x <= rx1; x++)
          for (const y of [ry0+s, ry1-s]) {
            if (y<0||y>=height||x<0||x>=width) continue;
            const i=(y*width+x)*4; diffPNG.data[i]=255; diffPNG.data[i+1]=0; diffPNG.data[i+2]=0; diffPNG.data[i+3]=255;
          }
        for (let y = ry0; y <= ry1; y++)
          for (const x of [rx0+s, rx1-s]) {
            if (x<0||x>=width||y<0||y>=height) continue;
            const i=(y*width+x)*4; diffPNG.data[i]=255; diffPNG.data[i+1]=0; diffPNG.data[i+2]=0; diffPNG.data[i+3]=255;
          }
      }
    };
    for (const [rx0,ry0,rx1,ry1] of rects) drawRect(rx0,ry0,rx1,ry1);
    fs.writeFileSync(diffPath, PNG.sync.write(diffPNG));
  } else {
    await fs.copyFile(baselinePath, diffPath);
  }

  return { passed, diffPercent: +diffPercent.toFixed(4), numDiff, width, height };
}

// POST /snapshots — Upload snapshot (CLI use)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { runId, name, viewport } = req.body;
    const snapshotPath = req.file.path;
    const snapshotUrl  = `/uploads/snapshots/${req.file.filename}`;

    // Look up baseline from DB
    const { rows: blRows } = await pool.query(
      'SELECT file_path FROM baselines WHERE user_id = (SELECT user_id FROM runs WHERE run_id=$1) AND page_name=$2 AND viewport=$3',
      [runId, name, viewport]
    );

    const diffFilename = `${name}_${viewport}_${Date.now()}_diff.png`;
    const diffPath     = path.join(UPLOADS, 'diffs', diffFilename);
    const diffUrl      = `/uploads/diffs/${diffFilename}`;

    let result = { passed: true, diffPercent: 0, isNew: false };

    if (blRows.length) {
      const cmp = await compareImages(blRows[0].file_path, snapshotPath, diffPath);
      result = { ...cmp, diffUrl };
    } else {
      // No baseline — get user_id from run and create baseline
      const { rows: runRows } = await pool.query('SELECT user_id FROM runs WHERE run_id=$1', [runId]);
      if (runRows.length) {
        const userId       = runRows[0].user_id;
        const baselineDir  = path.join(UPLOADS, 'baselines', userId);
        await fs.ensureDir(baselineDir);
        const baselinePath = path.join(baselineDir, `${name}_${viewport}.png`);
        const baselineUrl  = `/uploads/baselines/${userId}/${name}_${viewport}.png`;
        await fs.copy(snapshotPath, baselinePath);
        await pool.query(
          `INSERT INTO baselines (user_id, page_name, viewport, file_path, url_path)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (user_id, page_name, viewport) DO UPDATE
           SET file_path=$4, url_path=$5, approved_at=NOW()`,
          [userId, name, viewport, baselinePath, baselineUrl]
        );
      }
      result.isNew = true;
    }

    const newResult = { name, viewport, snapshotUrl, diffUrl: result.diffUrl || null, ...result };
    await pool.query(`
      UPDATE runs
      SET results = results || $1::jsonb,
          summary = jsonb_build_object(
            'total',  jsonb_array_length(results) + 1,
            'passed', (SELECT COUNT(*) FROM jsonb_array_elements(results || $1::jsonb) r WHERE (r->>'passed')::boolean),
            'failed', (SELECT COUNT(*) FROM jsonb_array_elements(results || $1::jsonb) r WHERE NOT (r->>'passed')::boolean)
          )
      WHERE run_id = $2
    `, [JSON.stringify([newResult]), runId]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /snapshots/approve — Promote a screenshot as the new baseline
router.post('/approve', authenticate, async (req, res) => {
  try {
    const { snapshotUrl, name, viewport } = req.body;
    const snapshotPath = path.join(__dirname, '..', snapshotUrl.replace('/uploads/', 'uploads/'));
    if (!await fs.pathExists(snapshotPath))
      return res.status(404).json({ error: 'Snapshot not found' });

    const baselineDir  = path.join(UPLOADS, 'baselines', req.user.id);
    await fs.ensureDir(baselineDir);
    const baselinePath = path.join(baselineDir, `${name}_${viewport}.png`);
    const baselineUrl  = `/uploads/baselines/${req.user.id}/${name}_${viewport}.png`;

    await fs.copy(snapshotPath, baselinePath);

    await pool.query(
      `INSERT INTO baselines (user_id, page_name, viewport, file_path, url_path)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, page_name, viewport) DO UPDATE
       SET file_path=$4, url_path=$5, approved_at=NOW()`,
      [req.user.id, name, viewport, baselinePath, baselineUrl]
    );

    res.json({ success: true, baselineUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /snapshots/baselines/:id
router.delete('/baselines/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM baselines WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Baseline not found' });
    await fs.remove(rows[0].file_path).catch(() => {});
    await pool.query('DELETE FROM baselines WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /snapshots/baselines — List all baselines for the current user
router.get('/baselines', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, page_name, viewport, url_path, approved_at FROM baselines WHERE user_id=$1 ORDER BY page_name, viewport',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
