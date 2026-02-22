const { TikTokLiveConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

// Configuration
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '@ultimateshades';
const RELAY_PORT = process.env.PORT || 8081;

// Create WebSocket server
const wss = new WebSocketServer({ port: RELAY_PORT });

console.log(`TikTok Relay Server started on ws://localhost:${RELAY_PORT}`);

// Create TikTok connection
let tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME);

// Connect to TikTok
function connectToTikTok() {
    tiktokConnection.connect().then(state => {
        console.info(`Connected to TikTok roomId ${state.roomId} (@${TIKTOK_USERNAME})`);
    }).catch(err => {
        console.error('Failed to connect to TikTok. Retrying in 10s...', err);
        setTimeout(connectToTikTok, 10000);
    });
}

connectToTikTok();

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
    console.warn('TikTok connection lost. Reconnecting...');
    connectToTikTok();
});

tiktokConnection.on('error', err => {
    console.error('TikTok error:', err);
});

// WebSocket Server Handlers
wss.on('connection', ws => {
    console.log('Frontend client connected to relay');
    ws.send(JSON.stringify({ type: 'info', message: `Connected to TikTok Relay (@${TIKTOK_USERNAME})` }));
});
