// Servidor del Fútbol Tenis: sirve la página y conecta a los jugadores por WebSocket.
// El que crea el partido corre la simulación; el servidor solo pasa mensajes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/health') { res.writeHead(200); res.end('ok'); return; }
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.endsWith('.html') ? 'no-cache' : 'public, max-age=86400' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const rooms = new Map(); // code -> { host, guest, specs:Set, o }
const ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
const newCode = () => { let c; do { c = Array.from({ length: 4 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); };

function openList() {
  const games = [];
  for (const [code, r] of rooms) if (!r.guest) games.push({ code, o: r.o });
  return { t: 'list', games: games.slice(-20) };
}
function broadcastList() {
  const msg = JSON.stringify(openList());
  for (const c of wss.clients) if (!c.room) send(c, msg);
}
function leave(ws) {
  const code = ws.room; if (!code) return;
  const r = rooms.get(code); ws.room = null;
  const role = ws.role; ws.role = null;
  if (!r) return;
  if (role === 'host') {
    for (const c of [r.guest, ...r.specs]) if (c) { send(c, { t: 'hostLeft' }); c.room = null; c.role = null; }
    rooms.delete(code);
  } else if (role === 'guest') {
    r.guest = null; send(r.host, { t: 'guest', on: false });
  } else r.specs.delete(ws);
  broadcastList();
}

wss.on('connection', ws => {
  ws.alive = true; ws.room = null; ws.role = null;
  ws.on('pong', () => { ws.alive = true; });
  send(ws, openList());
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const r = ws.room ? rooms.get(ws.room) : null;
    switch (m.t) {
      case 'g': // estado del partido, del anfitrión a los demás
        if (r && ws.role === 'host') { const s = JSON.stringify({ t: 'g', g: m.g }); send(r.guest, s); for (const c of r.specs) send(c, s); }
        break;
      case 'in': // controles del invitado al anfitrión
        if (r && ws.role === 'guest') send(r.host, { t: 'in', p: m.p });
        break;
      case 'host': {
        leave(ws);
        const code = newCode();
        const o = Array.isArray(m.o) ? [m.o[0] ? 1 : 0, [7, 11, 21].includes(m.o[1]) ? m.o[1] : 11] : [1, 11];
        rooms.set(code, { host: ws, guest: null, specs: new Set(), o });
        ws.room = code; ws.role = 'host';
        send(ws, { t: 'hosted', code });
        broadcastList();
        break;
      }
      case 'join': {
        const code = String(m.code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
        const room = rooms.get(code);
        if (!room) { send(ws, { t: 'err', msg: 'No hay ningún partido con ese código.' }); return; }
        if (room.host === ws) return;
        leave(ws);
        ws.room = code;
        if (!room.guest) { room.guest = ws; ws.role = 'guest'; send(room.host, { t: 'guest', on: true }); }
        else { room.specs.add(ws); ws.role = 'spec'; }
        send(ws, { t: 'welcome', code, role: ws.role });
        broadcastList();
        break;
      }
      case 'leave': leave(ws); send(ws, openList()); break;
    }
  });
  ws.on('close', () => leave(ws));
});

setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
}, 20000);

server.listen(PORT, () => console.log(`Fútbol Tenis andando en http://localhost:${PORT}`));
