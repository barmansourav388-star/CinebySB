require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'movies.json');
const MAX_UPLOAD_GB = Math.max(1, Number(process.env.MAX_UPLOAD_GB || 20));

for (const dir of [UPLOAD_DIR, DATA_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
  console.error('Missing ADMIN_PASSWORD or JWT_SECRET. Copy .env.example to .env and configure both values.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

function readMovies() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { console.error('Could not read movie database:', e); return []; }
}
function writeMovies(movies) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(movies, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function safeUnlink(name) {
  if (!name) return;
  const target = path.join(UPLOAD_DIR, path.basename(name));
  if (target.startsWith(UPLOAD_DIR + path.sep) && fs.existsSync(target)) fs.unlinkSync(target);
}
function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('Invalid role');
    next();
  } catch { res.status(401).json({ error: 'Admin session expired. Please sign in again.' }); }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_GB * 1024 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideo = file.fieldname === 'video' && ['.mp4', '.webm', '.m4v', '.mov'].includes(ext);
    const isPoster = file.fieldname === 'poster' && ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    cb(isVideo || isPoster ? null : new Error(file.fieldname === 'video' ? 'Use MP4, WebM, M4V or MOV video files.' : 'Poster must be JPG, PNG or WebP.'), isVideo || isPoster);
  }
});

app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }), (req, res) => {
  const password = String(req.body?.password || '');
  const expected = Buffer.from(process.env.ADMIN_PASSWORD);
  const supplied = Buffer.from(password);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return res.status(401).json({ error: 'Incorrect password.' });
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, expiresIn: 43200 });
});

app.get('/api/movies', (_req, res) => {
  const movies = readMovies().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(movies.map(({ id, title, description, year, genre, duration, video, poster, createdAt }) => ({
    id, title, description, year, genre, duration,
    videoUrl: `/media/${encodeURIComponent(video)}`,
    posterUrl: poster ? `/media/${encodeURIComponent(poster)}` : null,
    createdAt
  })));
});

app.post('/api/movies', requireAdmin, (req, res) => {
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${MAX_UPLOAD_GB} GB upload limit.` : err.message });
    const video = req.files?.video?.[0];
    const poster = req.files?.poster?.[0];
    if (!video) return res.status(400).json({ error: 'Choose a movie video file.' });
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (!title) { safeUnlink(video.filename); if (poster) safeUnlink(poster.filename); return res.status(400).json({ error: 'Movie title is required.' }); }
    const movie = {
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      title,
      description: String(req.body.description || '').trim().slice(0, 1500),
      year: String(req.body.year || '').trim().slice(0, 4),
      genre: String(req.body.genre || '').trim().slice(0, 50),
      duration: String(req.body.duration || '').trim().slice(0, 30),
      video: video.filename,
      poster: poster?.filename || null,
      createdAt: new Date().toISOString()
    };
    const movies = readMovies(); movies.push(movie); writeMovies(movies);
    res.status(201).json({ movie, shareUrl: `${process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`}/watch/${movie.id}` });
  });
});

app.delete('/api/movies/:id', requireAdmin, (req, res) => {
  const movies = readMovies();
  const movie = movies.find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found.' });
  writeMovies(movies.filter(m => m.id !== req.params.id));
  safeUnlink(movie.video); safeUnlink(movie.poster);
  res.json({ ok: true });
});

// Static media supports HTTP byte ranges, which enables seeking in the player.
app.use('/media', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '1h', setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin') }));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.status === 404 ? 'File not found.' : 'Server error.' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`cinebySB is running at http://localhost:${PORT}`));
