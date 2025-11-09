require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const ADMIN_KEY = process.env.ADMIN_KEY || 'adminkey';

app.use(express.json());
app.use(cors());

// serve frontend static
app.use(express.static(path.join(__dirname, '..', 'frontend', 'static')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'static', 'signup.html'));
});

// in-memory stores
const users = {}; // phone -> { id, phone, passwordHash }
const sockets = {}; // socketId -> userId

// Signup: phone (used as ID) + password + accessKey (admin)
app.post('/api/signup', async (req, res) => {
  try {
    const { phone, password, accessKey } = req.body;
    if (!phone || !password || !accessKey) return res.status(400).json({ error: 'Missing fields' });
    if (accessKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
    if (users[phone]) return res.status(400).json({ error: 'User already exists' });
    const hash = await bcrypt.hash(password, 10);
    users[phone] = { id: phone, phone, passwordHash: hash };
    const token = jwt.sign({ id: phone }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ id: phone, token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = users[phone];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ id: user.id, token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'no auth' });
    jwt.verify(auth, JWT_SECRET);
    const list = Object.values(users).map(u => ({ id: u.id, phone: u.phone }));
    return res.json(list);
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// register entry key (optional)
app.post('/api/entrykey', (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'no auth' });
    const payload = jwt.verify(auth, JWT_SECRET);
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'missing key' });
    // no persistence required for demo
    return res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
});

// Socket.io signaling & chat
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('auth', (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      sockets[socket.id] = payload.id;
      socket.join('public-broadcast');
      socket.emit('auth-ok', { id: payload.id });
    } catch (e) {
      socket.emit('auth-fail');
      socket.disconnect(true);
    }
  });

  socket.on('public-message', (msg) => {
    const from = sockets[socket.id] || 'unknown';
    io.to('public-broadcast').emit('public-message', { from, text: msg });
  });

  // Private room join by key
  socket.on('join-private', (key) => {
    const uid = sockets[socket.id];
    if (!uid) return;
    socket.join('private-' + key);
    socket.emit('joined-private', { key });
  });

  socket.on('private-message', ({ key, text }) => {
    const from = sockets[socket.id] || 'unknown';
    io.to('private-' + key).emit('private-message', { from, text });
  });

  // === Go Live: broadcaster announces start/stop
  socket.on('go-live', ({ id }) => {
    socket.broadcast.emit('live-started', { id });
    console.log(`🔴 ${id} started live broadcast`);
  });

  socket.on('stop-live', ({ id }) => {
    socket.broadcast.emit('live-stopped', { id });
    console.log(`⏹️ ${id} stopped broadcast`);
  });

  // Relay signaling data for live stream and public signaling
  socket.on('public-signal', (data) => {
    if (data.to === 'all') {
      socket.broadcast.emit('public-signal', { from: socket.id, ...data });
    } else if (data.to) {
      socket.to(data.to).emit('public-signal', { from: socket.id, ...data });
    } else {
      socket.broadcast.emit('public-signal', { from: socket.id, ...data });
    }
  });

  // Also accept private-signal (used by private.html)
  socket.on('private-signal', (obj) => {
    const targetId = obj.to;
    const targetSocketId = Object.keys(sockets).find(sid => sockets[sid] === targetId);
    if (targetSocketId) io.to(targetSocketId).emit('private-signal', { from: sockets[socket.id], payload: obj.payload });
  });

  socket.on('disconnect', () => {
    delete sockets[socket.id];
    console.log('socket disconnected', socket.id);
  });
});

server.listen(PORT, () => console.log('Backend running on port', PORT));
