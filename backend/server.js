const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const { init: dbInit } = require('./db');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const runRoutes = require('./routes/runs');
const snapshotRoutes = require('./routes/snapshots');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/runs', runRoutes);
app.use('/api/snapshots', snapshotRoutes);

async function init() {
  await fs.ensureDir(path.join(__dirname, 'uploads', 'snapshots'));
  await fs.ensureDir(path.join(__dirname, 'uploads', 'baselines'));
  await fs.ensureDir(path.join(__dirname, 'uploads', 'diffs'));
  await dbInit();
}

init().then(() => {
  app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
