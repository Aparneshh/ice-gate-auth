// server.js (drop this in project root)
'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();

// If you're running behind a proxy (Render / Cloudflare), keep this.
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// serve public folder (static assets, index.html, dashboard.html, css, images)
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';

// Simple in-memory users — update here
const USERS = {
  demo: { password: 'demo123', display: 'Demo User' },
  '6376_IRSpreetisinha': { password: 'Jaiguruji@0333#alpha', display: 'Friend User' }
};

app.use(session({
  name: 'sid',
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // secure cookies only in production (HTTPS). trust proxy = true above ensures req.secure works behind proxy.
    secure: (process.env.NODE_ENV === 'production'),
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/');
  }
  next();
}

// Helper: read login field in a forgiving way (case differences)
function readLoginFields(body) {
  // accept ssoid, SSOID, ssOId, ssoId, username
  const ssoid = body.ssoid || body.SSOID || body.ssoId || body.sso || body.username || body.user;
  const password = body.password || body.pass || body.pwd || body.Password;
  return { ssoid, password };
}

// POST /login
app.post('/login', (req, res) => {
  const { ssoid, password } = readLoginFields(req.body);

  if (!ssoid || !password) {
    // you can add query param for error message handling in client
    return res.redirect('/?err=missing');
  }

  const user = USERS[ssoid];
  if (!user || user.password !== password) {
    return res.redirect('/?err=invalid');
  }

  req.session.user = { id: ssoid, display: user.display || ssoid };

  // save then redirect to dashboard route (which serves dashboard.html)
  req.session.save(err => {
    if (err) console.error('session save error', err);
    return res.redirect('/dashboard'); // protected route below
  });
});

// GET /logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.redirect('/');
  });
});

// GET /dashboard (protected)
app.get('/dashboard', requireLogin, (req, res) => {
  // no caching for dashboard
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// simple API to return current user session (useful for app front-end)
app.get('/api/me', requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

/*
  Fallback handling:
  - If user requests an HTML route (user clicked a link or refreshed) -> serve public/index.html
  - If it's a request for an asset (starts with /api, /static, or wants JSON) -> return 404 to avoid redirect loops
*/
app.use((req, res, next) => {
  const accept = req.headers.accept || '';

  // if client expects JSON or it's an API path -> 404 (so assets don't get redirected)
  if (req.path.startsWith('/api') || accept.includes('application/json')) {
    return res.status(404).json({ error: 'Not found' });
  }

  // If the request target looks like a static asset (has an extension), return 404
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }

  // otherwise serve index.html (Single Page fallback or root)
  const indexFile = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(404).send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));