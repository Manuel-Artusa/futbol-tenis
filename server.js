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
  if (p === '/api/campeones') { champsApi(req, res); return; }
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.endsWith('.html') ? 'no-cache' : 'public, max-age=86400' });
    res.end(data);
  });
});

// ---- lista de campeones ----
// Si están SUPABASE_URL y SUPABASE_KEY, la lista se guarda en Supabase (gratis y no se borra).
// Si no, se guarda en un archivo, que en los hostings gratis se borra al reiniciar.
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_KEY || '';
const useSupabase = !!(SB_URL && SB_KEY);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CHAMPS_FILE = path.join(DATA_DIR, 'campeones.json');
let champs = [];
if (!useSupabase) { try { champs = JSON.parse(fs.readFileSync(CHAMPS_FILE, 'utf8')); if (!Array.isArray(champs)) champs = []; } catch (e) { champs = []; } }
function saveChampsFile() { fs.mkdir(DATA_DIR, { recursive: true }, () => fs.writeFile(CHAMPS_FILE, JSON.stringify(champs), () => {})); }
const sbHeaders = () => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' });
let sbCache = null, sbCacheAt = 0;
async function listChamps() {
  if (!useSupabase) return champs.slice(0, 100);
  if (sbCache && Date.now() - sbCacheAt < 10000) return sbCache;
  const r = await fetch(`${SB_URL}/rest/v1/campeones?select=nombre,dificultad,rival,resultado,creado&order=creado.desc&limit=100`, { headers: sbHeaders() });
  if (!r.ok) throw new Error('supabase ' + r.status);
  const rows = await r.json();
  sbCache = rows.map(x => ({ n: x.nombre, d: x.dificultad, r: x.rival || '', s: x.resultado || '', t: Date.parse(x.creado) || 0 }));
  sbCacheAt = Date.now();
  return sbCache;
}
async function addChamp(e) {
  if (!useSupabase) { champs.unshift(e); champs = champs.slice(0, 500); saveChampsFile(); return; }
  const r = await fetch(`${SB_URL}/rest/v1/campeones`, { method: 'POST', headers: Object.assign(sbHeaders(), { Prefer: 'return=minimal' }),
    body: JSON.stringify({ nombre: e.n, dificultad: e.d, rival: e.r, resultado: e.s }) });
  if (!r.ok) throw new Error('supabase ' + r.status);
  sbCache = null;
}
const lastPost = new Map();
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
function champsApi(req, res) {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET') { listChamps().then(a => json(200, a)).catch(err => { console.error(err.message); json(502, { error: 'no se pudo leer la lista' }); }); return; }
  if (req.method !== 'POST') return json(405, { error: 'método no permitido' });
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  if (now - (lastPost.get(ip) || 0) < 15000) return json(429, { error: 'esperá un poco' });
  let body = '';
  req.on('data', c => { body += c; if (body.length > 2000) req.destroy(); });
  req.on('end', () => {
    let e; try { e = JSON.parse(body); } catch (err) { return json(400, { error: 'datos inválidos' }); }
    const entry = { n: clean(e.n, 16) || 'Sin nombre', d: [0, 1, 2].includes(e.d) ? e.d : 0, r: clean(e.r, 40), s: /^\d{1,2}–\d{1,2}$/.test(e.s) ? e.s : '', t: now };
    lastPost.set(ip, now);
    addChamp(entry).then(() => json(200, { ok: true })).catch(err => { console.error(err.message); lastPost.delete(ip); json(502, { error: 'no se pudo guardar' }); });
  });
}
console.log(useSupabase ? 'Campeones: se guardan en Supabase' : 'Campeones: se guardan en un archivo (se borra al reiniciar en hostings gratis)');

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