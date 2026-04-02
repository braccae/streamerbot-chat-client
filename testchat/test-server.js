const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Ports ────────────────────────────────────────────────────────────────────
const STREAMERBOT_PORT = 8080;
const TIKTOK_PORT      = 8081;
const HTTP_PORT        = 8082;

// ── Streamerbot Emulation (port 8080) ────────────────────────────────────────
const sbWss = new WebSocketServer({ port: STREAMERBOT_PORT });
let sbSubscriptions = new Map(); // ws → Set of event names

sbWss.on('connection', ws => {
    console.log(`[Streamerbot] Client connected (${sbWss.clients.size} total)`);

    ws.on('message', raw => {
        try {
            const msg = JSON.parse(raw.toString());

            // Handle Subscribe requests from @streamerbot/client
            if (msg.request === 'Subscribe') {
                const events = [];
                if (msg.events) {
                    for (const [source, names] of Object.entries(msg.events)) {
                        for (const name of names) {
                            events.push(`${source}.${name}`);
                        }
                    }
                }
                if (!sbSubscriptions.has(ws)) sbSubscriptions.set(ws, new Set());
                const subs = sbSubscriptions.get(ws);
                events.forEach(e => subs.add(e));

                ws.send(JSON.stringify({
                    id: msg.id,
                    status: 'ok',
                    events: Object.fromEntries(
                        Object.entries(msg.events || {}).map(([src, names]) => [
                            src,
                            names.map(n => ({ name: n, enabled: true }))
                        ])
                    )
                }));
                console.log(`[Streamerbot] Subscribed to: ${events.join(', ')}`);
            }

            // Handle GetInfo (the client sends this on connect)
            if (msg.request === 'GetInfo') {
                ws.send(JSON.stringify({
                    id: msg.id,
                    status: 'ok',
                    info: {
                        instanceId: 'test-server-00000',
                        name: 'Test Streamer.bot',
                        os: 'linux',
                        version: '0.0.0',
                        source: 'test'
                    }
                }));
            }
        } catch (_) { /* ignore */ }
    });

    ws.on('close', () => {
        sbSubscriptions.delete(ws);
        console.log(`[Streamerbot] Client disconnected (${sbWss.clients.size} total)`);
    });
});

function broadcastStreamerbotEvent(eventSource, eventType, data) {
    const fullEvent = `${eventSource}.${eventType}`;
    const payload = JSON.stringify({
        timeStamp: new Date().toISOString(),
        event: { source: eventSource, type: eventType },
        data
    });

    sbWss.clients.forEach(ws => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const subs = sbSubscriptions.get(ws);
        // Send if subscribed or if no subscription filter
        if (!subs || subs.has(fullEvent)) {
            ws.send(payload);
        }
    });
}

// ── TikTok Relay Emulation (port 8081) ───────────────────────────────────────
const tkWss = new WebSocketServer({ port: TIKTOK_PORT });

tkWss.on('connection', ws => {
    console.log(`[TikTok] Client connected (${tkWss.clients.size} total)`);
    ws.send(JSON.stringify({ type: 'info', message: 'Connected to local relay server.' }));
    ws.send(JSON.stringify({
        type: 'info',
        message: 'Connected to TikTok LIVE (Test Mode)'
    }));

    ws.on('message', raw => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (_) { /* ignore */ }
    });

    ws.on('close', () => {
        console.log(`[TikTok] Client disconnected (${tkWss.clients.size} total)`);
    });
});

function broadcastTikTok(data) {
    const payload = JSON.stringify(data);
    tkWss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
}

// ── Message Builders ─────────────────────────────────────────────────────────

function buildTwitchEvent(username, message) {
    return {
        message: {
            displayName: username,
            name: username.toLowerCase(),
            msgId: `test-${Date.now()}`,
            userId: `${Math.floor(Math.random() * 999999)}`,
            role: 1,
        },
        parts: [{ type: 'text', text: message }],
        text: message,
    };
}

function buildYouTubeEvent(username, message) {
    return {
        user: {
            name: username,
            profileImageUrl: '',
            isChatOwner: false,
            isChatSponsor: false,
            isChatModerator: false,
        },
        parts: [{ text: message }],
    };
}

function buildTikTokChat(username, message) {
    return {
        type: 'tiktok-chat',
        user: { name: username, id: username.toLowerCase() },
        message,
    };
}

function buildTikTokGift(username, giftName, count) {
    return {
        type: 'tiktok-gift',
        user: { name: username, id: username.toLowerCase() },
        gift: giftName,
        giftIcon: null,
        count: count || 1,
    };
}

// ── HTTP Control API + Static Server (port 8082) ─────────────────────────────

const MIME_TYPES = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
};

const PROJECT_ROOT = path.resolve(__dirname, '..');

const httpServer = http.createServer((req, res) => {
    // ── API Routes ───────────────────────────────────────────────────────
    if (req.method === 'POST' && req.url === '/send') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            try {
                const { platform, username, message, giftName, giftCount } = JSON.parse(body);
                handleSend(platform, username, message, giftName, giftCount);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            streamerbot: { clients: sbWss.clients.size },
            tiktok:      { clients: tkWss.clients.size },
        }));
        return;
    }

    // ── /env endpoint (so the frontend fetchEnv() works in local mode) ──
    if (req.method === 'GET' && req.url === '/env') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ backendUrl: `ws://127.0.0.1:${TIKTOK_PORT}` }));
        return;
    }

    // ── Static File Serving ──────────────────────────────────────────────
    let filePath;
    if (req.url === '/' || req.url === '/testchat' || req.url === '/testchat/') {
        filePath = path.join(__dirname, 'index.html');
    } else if (req.url.startsWith('/testchat/')) {
        filePath = path.join(__dirname, req.url.replace('/testchat/', ''));
    } else {
        // Serve project root files (index.html, script.js, style.css, etc.)
        const cleanUrl = req.url.split('?')[0];
        filePath = path.join(PROJECT_ROOT, cleanUrl);
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

function handleSend(platform, username, message, giftName, giftCount) {
    switch (platform) {
        case 'twitch':
            broadcastStreamerbotEvent('Twitch', 'ChatMessage', buildTwitchEvent(username, message));
            console.log(`[Send] Twitch – ${username}: ${message}`);
            break;
        case 'youtube':
            broadcastStreamerbotEvent('YouTube', 'Message', buildYouTubeEvent(username, message));
            console.log(`[Send] YouTube – ${username}: ${message}`);
            break;
        case 'tiktok':
            broadcastTikTok(buildTikTokChat(username, message));
            console.log(`[Send] TikTok – ${username}: ${message}`);
            break;
        case 'tiktok-gift':
            broadcastTikTok(buildTikTokGift(username, giftName || 'Rose', giftCount || 1));
            console.log(`[Send] TikTok Gift – ${username}: ${giftName} x${giftCount}`);
            break;
        default:
            throw new Error(`Unknown platform: ${platform}`);
    }
}

httpServer.listen(HTTP_PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║          🧪  Test Chat Server Running  🧪            ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║  Streamerbot WS  →  ws://localhost:${STREAMERBOT_PORT}              ║`);
    console.log(`║  TikTok Relay WS →  ws://localhost:${TIKTOK_PORT}              ║`);
    console.log(`║  HTTP Dashboard  →  http://localhost:${HTTP_PORT}/testchat/    ║`);
    console.log(`║  Chat Frontend   →  http://localhost:${HTTP_PORT}/index.html?local=true  ║`);
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
});
