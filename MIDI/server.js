'use strict';

/**
 * Wireless MIDI control surface server.
 *
 * Signal path:
 *   iPad Safari  ->  WebSocket (this server)  ->  easymidi  ->  IAC / virtual port  ->  MainStage
 *
 * The browser never uses Web MIDI (unsupported on iOS Safari). It only speaks
 * JSON over a WebSocket, and this process turns those messages into real MIDI.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const easymidi = require('easymidi');

const PORT = 3000;
const VIRTUAL_NAME = 'iPad Surface';
const MIDI_CHANNEL = 16;            // musical channel we advertise (1-16)
const EASY_CHANNEL = MIDI_CHANNEL - 1; // easymidi is 0-based (0-15)

// ---------------------------------------------------------------------------
// MIDI output: prefer the IAC Driver bus (persists across server restarts, so
// MainStage's MIDI binding never breaks). Fall back to a virtual port.
// ---------------------------------------------------------------------------
let output = null;
let boundPort = null;

const existing = easymidi.getOutputs();
const iac = existing.find((name) => name.toUpperCase().includes('IAC'));

if (iac) {
  try {
    output = new easymidi.Output(iac, false);
    boundPort = iac;
    console.log(`[midi] Using IAC output "${boundPort}"`);
  } catch (err) {
    console.error(`[midi] Could not open IAC output "${iac}": ${err.message}`);
  }
}

if (!output) {
  try {
    output = new easymidi.Output(VIRTUAL_NAME, true);
    boundPort = VIRTUAL_NAME;
    console.log(`[midi] Created virtual output "${boundPort}"`);
    if (!iac) {
      console.error('[midi] No IAC bus found. In Audio MIDI Setup: Window > Show MIDI Studio >');
      console.error('[midi] double-click "IAC Driver" > tick "Device is online" > OK, then restart.');
    }
  } catch (err) {
    console.error(`[midi] Could not create virtual output "${VIRTUAL_NAME}": ${err.message}`);
  }
}

if (!output) {
  console.error('[midi] No MIDI output available. Exiting. Fix the MIDI port and restart with npm start.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Static file server for public/
// ---------------------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Resolve and confine to PUBLIC_DIR (block path traversal).
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// WebSocket server (same HTTP port)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server });

function clampByte(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(127, n));
}

function clampWord(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(16383, n)); // 14-bit pitch bend (8192 = center)
}

function sendMidi(msg) {
  if (msg.type === 'cc') {
    let controller = clampByte(msg.controller);
    let value = clampByte(msg.value);
    if (controller === null || value === null) return; // malformed -> ignore
    output.send('cc', { channel: EASY_CHANNEL, controller, value });
    console.log(`CC channel=${MIDI_CHANNEL} controller=${controller} value=${value}`);
  } else if (msg.type === 'pitch') {
    let value = clampWord(msg.value);
    if (value === null) return; // malformed -> ignore
    output.send('pitch', { channel: EASY_CHANNEL, value });
    console.log(`PITCH channel=${MIDI_CHANNEL} value=${value}`);
  } else if (msg.type === 'noteon') {
    let note = clampByte(msg.note);
    let velocity = clampByte(msg.velocity);
    if (note === null) return;
    if (velocity === null) velocity = 127;
    output.send('noteon', { channel: EASY_CHANNEL, note, velocity });
    console.log(`NOTEON channel=${MIDI_CHANNEL} note=${note} velocity=${velocity}`);
  } else if (msg.type === 'noteoff') {
    let note = clampByte(msg.note);
    let velocity = clampByte(msg.velocity);
    if (note === null) return;
    if (velocity === null) velocity = 0;
    output.send('noteoff', { channel: EASY_CHANNEL, note, velocity });
    console.log(`NOTEOFF channel=${MIDI_CHANNEL} note=${note} velocity=${velocity}`);
  } else if (msg.type === 'panic') {
    for (let ch = 0; ch < 16; ch++) {
      output.send('cc', { channel: ch, controller: 123, value: 0 });
    }
    console.log('PANIC all channels (CC 123 = 0)');
  }
}

// ---------------------------------------------------------------------------
// macOS notification helper (connection indicator)
// ---------------------------------------------------------------------------
const { execSync } = require('child_process');

function macNotify(title, message) {
  try {
    execSync(`osascript -e 'display notification "${message}" with title "${title}" sound name "${title.includes('Disconnected') ? 'Basso' : 'Glass'}"'`, { timeout: 3000, stdio: 'ignore' });
  } catch (_) { /* non-fatal: notifications not critical */ }
}

// ---------------------------------------------------------------------------
// WebSocket server (same HTTP port)
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('[ws] iPad connected');
  macNotify('iPad MIDI Surface', 'iPad connected — ready to play');
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return; // ignore non-JSON
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cc' || msg.type === 'pitch' || msg.type === 'noteon' || msg.type === 'noteoff' || msg.type === 'panic') {
      sendMidi(msg);
    }
    // anything else is silently ignored
  });
  ws.on('close', () => {
    console.log('[ws] iPad disconnected');
    macNotify('iPad MIDI Surface Disconnected', 'iPad lost connection — check wifi');
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  printBanner();
});

// ---------------------------------------------------------------------------
// Startup banner: the most important line of output.
// ---------------------------------------------------------------------------
function printBanner() {
  const addresses = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        addresses.push(ni.address);
      }
    }
  }

  const bar = '============================================================';
  console.log('');
  console.log(bar);
  console.log('  iPad MIDI Surface is running.');
  console.log(`  MIDI bound to port: "${boundPort}"  (channel ${MIDI_CHANNEL})`);
  console.log('');
  console.log('  OPEN THIS ON THE IPAD (use the address that matches the');
  console.log('  iPad wifi network):');
  for (const ip of addresses) {
    console.log(`    >>>  http://${ip}:${PORT}   <<<`);
  }
  console.log(bar);
  console.log('');
  console.log('  If you see no address above, the Mac has no active network');
  console.log('  interface. Connect to the venue wifi and restart.');
  console.log('');
}
