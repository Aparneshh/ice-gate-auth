// server.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'users.db');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
  store: new SQLiteStore({ db: 'sess.sqlite', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'change_this_secret_in_prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function findUser(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function createUser(username, password) {
  return bcrypt.hash(password, 10).then(hash => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO users(username, password_hash) VALUES(?,?)', [username, hash], function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, username });
      });
    });
  });
}

function updatePassword(username, newPassword) {
  return bcrypt.hash(newPassword, 10).then(hash => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username], function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  });
}

// seed default users (only if missing)
(async function seed() {
  try {
    const rows = await new Promise((res, rej) => db.all('SELECT username FROM users', (e, r) => e ? rej(e) : res(r)));
    const existing = (rows || []).map(r => r.username);
    const wanted = [
      { u: 'admin', p: 'demo123' },
      { u: 'demo', p: 'demo123' },
      { u: '6376_IRSpreetisinha', p: 'Jaiguruji@0333#alpha' }
    ];
    for (const w of wanted) {
      if (!existing.includes(w.u)) {
        try { await createUser(w.u, w.p); console.log('Created user', w.u); } catch(e){ /* ignore */ }
      }
    }
    console.log('Seeding complete');
  } catch (e) {
    console.warn('Seed error', e);
  }
})();

// auth endpoints
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing' });
  try {
    const user = await findUser(username);
    if (!user) return res.status(401).json({ error: 'invalid' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid' });
    req.session.user = { id: user.id, username: user.username };
    return res.json({ ok: true, username: user.username });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing' });
  try {
    await createUser(username, password);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'could_not_create' });
  }
});

app.post('/api/change-password', async (req, res) => {
  if (!req.session.user) return res.status(403).json({ error: 'not_logged_in' });
  const username = req.session.user.username;
  const { newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'missing' });
  try {
    await updatePassword(username, newPassword);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.warn(err);
    res.json({ ok: true });
  });
});

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.accepts('html')) return res.redirect('/');
  return res.status(401).json({ error: 'unauthorized' });
}

app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/api/whoami', (req, res) => {
  if (req.session && req.session.user) return res.json({ user: req.session.user });
  res.json({ user: null });
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));