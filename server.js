const { TikTokLiveConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

// Configuration
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '@ultimateshades';
const RELAY_PORT = process.env.PORT || 8081;

// Retry interval while waiting for the stream to start (60 seconds)
const RETRY_INTERVAL_MS = 60 * 1000;

// Create WebSocket server
const wss = new WebSocketServer({ port: RELAY_PORT });

console.log(`TikTok Relay Server started on ws://localhost:${RELAY_PORT}`);

let retryTimeout = null;
let disconnectTimeout = null;
let shouldBeConnected = false;
let isTikTokConnected = false;

// The active connection instance. A fresh one is created for each attempt
// because the v2 library holds internal state that prevents reconnecting on
// the same instance after a failed connect.
let tiktokConnection = null;

// ------------------------------------------------------------------
// Connection factory — returns a new TikTokLiveConnection with all
// event listeners attached.
// ------------------------------------------------------------------
function createConnection() {
    const conn = new TikTokLiveConnection(TIKTOK_USERNAME, {
        // Skip the room-info pre-flight check. TikTok's API unreliably
        // returns status=4 (offline) even when the streamer IS live,
        // which would throw UserOfflineError and block the connection.
        fetchRoomInfoOnConnect: false,
        webClientOptions: { timeout: 15000 },
        wsClientOptions: { timeout: 15000 },
    });

    conn.on('chat', data => {
        const user = data.user || {};
        const nick = user.nickname || user.uniqueId || 'TikTok User';
        console.log(`[chat] ${user.uniqueId}: ${data.comment}`);
        broadcast({
            type: 'tiktok-chat',
            user: { name: nick, id: user.uniqueId },
            message: data.comment
        });
    });

    conn.on('gift', data => {
        const user = data.user || {};
        const nick = user.nickname || user.uniqueId || 'TikTok User';
        // After simplifyObject, giftDetails is merged flat: name is at data.giftName,
        // and the icon URL is at data.giftPictureUrl.
        const giftName = data.giftName || String(data.giftId) || 'Gift';
        const giftIconUrl = data.giftPictureUrl || null;
        console.log(`[gift] ${user.uniqueId} sent ${giftName} x${data.repeatCount}`);
        broadcast({
            type: 'tiktok-gift',
            user: { name: nick, id: user.uniqueId },
            gift: giftName,
            giftIcon: giftIconUrl,
            count: data.repeatCount
        });
    });

    conn.on('disconnected', () => {
        console.warn('[TikTok] Connection lost.');
        isTikTokConnected = false;
        broadcast({ type: 'tiktok-status', connected: false, message: 'TikTok connection lost.' });
        if (shouldBeConnected) {
            console.log('[TikTok] Scheduling reconnect in 60s...');
            scheduleRetry(RETRY_INTERVAL_MS);
        }
    });

    conn.on('error', err => {
        console.error('[TikTok] Error:', err);
    });

    return conn;
}

// ------------------------------------------------------------------
// Attempt a single connection. On failure, schedule a retry.
// ------------------------------------------------------------------
function connectToTikTok() {
    if (!shouldBeConnected) return;

    // Always start from a fresh instance so internal state is clean.
    tiktokConnection = createConnection();

    console.log(`[TikTok] Attempting to connect (@${TIKTOK_USERNAME})...`);
    broadcast({ type: 'tiktok-status', connected: false, message: `Connecting to TikTok (@${TIKTOK_USERNAME})…` });

    tiktokConnection.connect()
        .then(state => {
            isTikTokConnected = true;
            clearTimeout(retryTimeout);
            retryTimeout = null;
            console.log(`[TikTok] Connected to roomId ${state.roomId} (@${TIKTOK_USERNAME})`);
            broadcast({ type: 'tiktok-status', connected: true, message: `Connected to TikTok LIVE (@${TIKTOK_USERNAME})!` });
        })
        .catch(err => {
            isTikTokConnected = false;
            const errName = err?.constructor?.name || 'Error';
            console.warn(`[TikTok] Connect failed (${errName}). Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
            broadcast({
                type: 'tiktok-status',
                connected: false,
                message: `Not live yet — retrying in ${RETRY_INTERVAL_MS / 1000}s…`
            });
            scheduleRetry(RETRY_INTERVAL_MS);
        });
}

function scheduleRetry(delayMs) {
    if (!shouldBeConnected) return;
    clearTimeout(retryTimeout);
    retryTimeout = setTimeout(connectToTikTok, delayMs);
}

// ------------------------------------------------------------------
// Broadcast helper
// ------------------------------------------------------------------
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// ------------------------------------------------------------------
// WebSocket server — frontend clients connect here
// ------------------------------------------------------------------
wss.on('connection', ws => {
    console.log(`[Relay] Frontend connected. Total clients: ${wss.clients.size}`);
    ws.send(JSON.stringify({ type: 'info', message: 'Connected to local relay server.' }));

    // Cancel any pending graceful-disconnect if a client reconnects
    clearTimeout(disconnectTimeout);
    disconnectTimeout = null;

    if (isTikTokConnected) {
        ws.send(JSON.stringify({
            type: 'tiktok-status',
            connected: true,
            message: `Already connected to TikTok LIVE (@${TIKTOK_USERNAME})!`
        }));
    } else if (!shouldBeConnected) {
        // First client — kick off the TikTok connection loop
        shouldBeConnected = true;
        connectToTikTok();
    } else {
        ws.send(JSON.stringify({
            type: 'tiktok-status',
            connected: false,
            message: 'Waiting for stream to start — retrying every 60s…'
        }));
    }

    ws.on('message', rawData => {
        try {
            const msg = JSON.parse(rawData.toString());
            if (msg.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (_) { /* ignore */ }
    });

    ws.on('close', () => {
        console.log(`[Relay] Frontend disconnected. Total clients: ${wss.clients.size}`);
        if (wss.clients.size === 0) {
            console.log('[Relay] No clients. Will stop TikTok connection in 5 minutes.');
            disconnectTimeout = setTimeout(() => {
                if (wss.clients.size === 0) {
                    console.log('[Relay] Stopping TikTok connection (no clients for 5 minutes).');
                    shouldBeConnected = false;
                    isTikTokConnected = false;
                    clearTimeout(retryTimeout);
                    retryTimeout = null;
                    if (tiktokConnection) {
                        tiktokConnection.disconnect();
                        tiktokConnection = null;
                    }
                }
            }, 5 * 60 * 1000);
        }
    });
});
