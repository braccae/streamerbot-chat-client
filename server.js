const { TikTokLiveConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

// Configuration
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '@ultimateshades';
const RELAY_PORT = process.env.PORT || 8081;

// Create WebSocket server
const wss = new WebSocketServer({ port: RELAY_PORT });

console.log(`TikTok Relay Server started on ws://localhost:${RELAY_PORT}`);

// Create TikTok connection with increased timeouts
let tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME, {
    clientParams: {
        timeout: 15000 // 15 seconds
    },
    requestOptions: {
        timeout: 15000
    },
    websocketOptions: {
        timeout: 15000
    }
});

let retryCount = 0;
let retryTimeout = null;
let disconnectTimeout = null;
let shouldBeConnected = false;

// Connect to TikTok
function connectToTikTok() {
    if (!shouldBeConnected) {
        console.log('Connection not required, skipping TikTok connection.');
        return;
    }

    console.log(`Attempting to connect to TikTok (@${TIKTOK_USERNAME})...`);
    tiktokConnection.connect().then(state => {
        retryCount = 0;
        console.info(`Connected to TikTok roomId ${state.roomId} (@${TIKTOK_USERNAME})`);
    }).catch(err => {
        retryCount++;
        const delay = Math.min(10000 * Math.pow(2, retryCount - 1), 300000); // Max 5 minutes
        console.error(`Failed to connect to TikTok. Retrying in ${delay / 1000}s...`, err);
        clearTimeout(retryTimeout);
        retryTimeout = setTimeout(connectToTikTok, delay);
    });
}
// Broadcast helper
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

// TikTok Event Listeners
tiktokConnection.on('chat', data => {
    const user = data.user || {};
    const nick = user.nickname || user.uniqueId || 'TikTok User';
    console.log(`${user.uniqueId}: ${data.comment}`);
    broadcast({
        type: 'tiktok-chat',
        user: {
            name: nick,
            id: user.uniqueId
        },
        message: data.comment
    });
});

tiktokConnection.on('gift', data => {
    const user = data.user || {};
    const nick = user.nickname || user.uniqueId || 'TikTok User';
    console.log(`${user.uniqueId} sent ${data.giftName}`);
    broadcast({
        type: 'tiktok-gift',
        user: {
            name: nick,
            id: user.uniqueId
        },
        gift: data.giftName,
        count: data.repeatCount
    });
});

tiktokConnection.on('disconnected', () => {
    console.warn('TikTok connection lost.');
    if (shouldBeConnected) {
        console.log('Active session. Reconnecting...');
        clearTimeout(retryTimeout);
        connectToTikTok();
    }
});

tiktokConnection.on('error', err => {
    console.error('TikTok error:', err);
});

// WebSocket Server Handlers
wss.on('connection', ws => {
    console.log(`Frontend client connected to relay. Total clients: ${wss.clients.size}`);
    ws.send(JSON.stringify({ type: 'info', message: `Connected to TikTok Relay (@${TIKTOK_USERNAME})` }));

    clearTimeout(disconnectTimeout);
    disconnectTimeout = null;

    if (!shouldBeConnected) {
        shouldBeConnected = true;
        retryCount = 0;
        clearTimeout(retryTimeout);
        connectToTikTok();
    }

    ws.on('close', () => {
        console.log(`Frontend client disconnected. Total clients: ${wss.clients.size}`);
        if (wss.clients.size === 0) {
            console.log('All clients disconnected. Scheduling TikTok disconnect in 5 minutes.');
            disconnectTimeout = setTimeout(() => {
                if (wss.clients.size === 0) {
                    console.log('5 minutes passed with no clients. Stopping TikTok connection.');
                    shouldBeConnected = false;
                    clearTimeout(retryTimeout);
                    tiktokConnection.disconnect();
                }
            }, 300000); // 5 minutes
        }
    });
});
