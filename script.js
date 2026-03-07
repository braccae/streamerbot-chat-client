const chatLog = document.getElementById("chatLog");

// Per-session user color map (resets on page refresh)
const userColorMap = new Map();

function getUserColor(username) {
    if (userColorMap.has(username)) return userColorMap.get(username);
    // Hash the username to a hue value (0–359)
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    // Use HSL: fixed saturation, lightness between 40–55% so it's colorful but not too dark/bright
    const lightness = 40 + (hash % 16);
    const color = `hsl(${hue}, 80%, ${lightness}%)`;
    userColorMap.set(username, color);
    return color;
}

// Check for transparent query parameter
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('transparent') === 'true') {
    document.body.classList.add('transparent-mode');
}

// ── Holiday Easter Eggs ──────────────────────────────────────────────────────
(function () {
    const _now = new Date();
    const _month = _now.getMonth() + 1; // 1-indexed
    const _day = _now.getDate();
    const _dow = _now.getDay();       // 0=Sun … 6=Sat (5=Fri)

    window.HOLIDAY = {
        aprilFools: _month === 4 && _day === 1,
        valentines: _month === 2 && _day === 14,
        halloween: _month === 10 && _day === 31,
        christmas: _month === 12 && _day === 25,
        stPatricks: _month === 3 && _day === 17,
        newYears: _month === 1 && _day === 1,
        friday13: _dow === 5 && _day === 13,
    };
})();

// Upside-down character map for April Fools
const FLIP_MAP = {
    'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ', 'h': 'ɥ',
    'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd',
    'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x',
    'y': 'ʎ', 'z': 'z',
    'A': '∀', 'B': 'ᗺ', 'C': 'Ɔ', 'D': 'ᗡ', 'E': 'Ǝ', 'F': 'Ⅎ', 'G': 'פ', 'H': 'H',
    'I': 'I', 'J': 'ſ', 'K': 'ʞ', 'L': '˥', 'M': 'W', 'N': 'N', 'O': 'O', 'P': 'Ԁ',
    'Q': 'Q', 'R': 'ᴚ', 'S': 'S', 'T': '┴', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X',
    'Y': '⅄', 'Z': 'Z',
    '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ',
    '8': '8', '9': '6',
    ',': '\'', '.': ', ', '?': '¿', '!': '¡', '(': ')', ')': '(',
    '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
    "'": ',', '"': '„', '`': ',', ' ': ' ',
};

function flipText(str) {
    return str
        .split('')
        .map(ch => FLIP_MAP[ch] ?? ch)
        .reverse()
        .join('');
}

/**
 * Applies any active holiday effect to a chat message string.
 * Returns the (possibly transformed) string.
 */
function applyHolidayEffects(text) {
    if (!window.HOLIDAY) return text;
    const H = window.HOLIDAY;

    if (H.aprilFools) return flipText(text);
    if (H.valentines) return `❤️ ${text} ❤️`;
    if (H.halloween) return `🎃 ${text} 👻`;
    if (H.christmas) return `🎄 ${text} 🎁`;
    if (H.stPatricks) return `🍀 ${text} 🍀`;
    if (H.newYears) return `🎆 ${text} 🥂`;

    return text;
}

function addLogMessage(message, className = "systemMessage") {
    const messageElement = document.createElement("div");
    messageElement.classList.add(...className.split(" "));
    messageElement.innerHTML = message;
    chatLog.appendChild(messageElement);

    // Smooth scroll to the bottom of the chat text area
    const chatTextArea = document.querySelector(".chat-text-area");
    requestAnimationFrame(() => {
        chatTextArea.scrollTo({
            top: chatTextArea.scrollHeight,
            behavior: "smooth",
        });
    });
}

const client = new StreamerbotClient({
    host: "127.0.0.1",
    port: 8080,
    endpoint: "/",
    onConnect: () => {
        const botStatus = document.getElementById('bot-status');
        if (botStatus) {
            botStatus.classList.remove('disconnected');
            botStatus.classList.add('connected');
        }
    },
    onDisconnect: () => {
        const botStatus = document.getElementById('bot-status');
        if (botStatus) {
            botStatus.classList.remove('connected');
            botStatus.classList.add('disconnected');
        }
    },
    onError: (error) => {
        console.error("WebSocket error:", error);
        const botStatus = document.getElementById('bot-status');
        if (botStatus) {
            botStatus.classList.remove('connected');
            botStatus.classList.add('disconnected');
        }
    },
});

// TikTok Relay Connection
let tiktokRelay = null;
let tiktokPingInterval = null;
let tiktokReconnectTimer = null;
let tiktokBackendUrl = 'ws://127.0.0.1:8081'; // default

async function fetchEnv() {
    try {
        const response = await fetch('/env');
        if (response.ok) {
            const data = await response.json();
            if (data.backendUrl) {
                tiktokBackendUrl = data.backendUrl;
            }
        }
    } catch (e) {
        console.warn('Could not fetch /env, using default ws://127.0.0.1:8081', e);
    }
}

async function connectTikTokRelay() {
    // If already connecting or connected, do nothing
    if (tiktokRelay && (tiktokRelay.readyState === WebSocket.OPEN || tiktokRelay.readyState === WebSocket.CONNECTING)) {
        return;
    }

    console.log(`Attempting to connect to TikTok relay at: ${tiktokBackendUrl}`);
    tiktokRelay = new WebSocket(tiktokBackendUrl);

    tiktokRelay.onopen = () => {
        console.log('Connected to TikTok Relay server');
        // Start keepalive ping
        clearInterval(tiktokPingInterval);
        tiktokPingInterval = setInterval(() => {
            if (tiktokRelay.readyState === WebSocket.OPEN) {
                tiktokRelay.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // 30 seconds
    };

    tiktokRelay.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const tiktokStatus = document.getElementById('tiktok-status');

        if (data.type === 'info') {
            console.log("Relay Info:", data.message);
            if (data.message.includes('Connected to TikTok LIVE') || data.message.includes('Already connected to TikTok LIVE')) {
                if (tiktokStatus) {
                    tiktokStatus.classList.remove('disconnected');
                    tiktokStatus.classList.add('connected');
                }
            } else if (data.message.includes('TikTok connection lost') || data.message.includes('TikTok connection failed')) {
                if (tiktokStatus) {
                    tiktokStatus.classList.remove('connected');
                    tiktokStatus.classList.add('disconnected');
                }
            }
        } else if (data.type === 'tiktok-chat') {
            const messageElement = document.createElement("div");
            messageElement.classList.add("chatMessage");
            const tiktokColor = getUserColor(data.user.name);
            const tiktokMsg = applyHolidayEffects(data.message);
            messageElement.innerHTML = `<span class="username tiktok">[TikTok]</span> <span style="color:${tiktokColor}">${data.user.name}:</span> ${tiktokMsg}`;
            chatLog.appendChild(messageElement);

            scrollToBottom();
        } else if (data.type === 'tiktok-gift') {
            const giftIconHtml = data.giftIcon
                ? `<img src="${data.giftIcon}" alt="${data.gift}" style="height:1.2em;vertical-align:middle;margin-right:2px;">`
                : '🎁';
            addLogMessage(`${giftIconHtml} ${data.user.name} sent ${data.gift} x${data.count}`, "systemMessage green");
        }
    };

    tiktokRelay.onerror = (error) => {
        console.error('TikTok Relay error:', error);
    };

    tiktokRelay.onclose = () => {
        console.log('TikTok Relay connection closed');
        clearInterval(tiktokPingInterval);
        const tiktokStatus = document.getElementById('tiktok-status');
        if (tiktokStatus) {
            tiktokStatus.classList.remove('connected');
            tiktokStatus.classList.add('disconnected');
        }
    };
}

async function initTikTokRelay() {
    await fetchEnv();
    await connectTikTokRelay();

    // Reconnection logic: attempt to connect every minute if disconnected
    if (tiktokReconnectTimer) clearInterval(tiktokReconnectTimer);
    tiktokReconnectTimer = setInterval(() => {
        if (!tiktokRelay || (tiktokRelay.readyState !== WebSocket.OPEN && tiktokRelay.readyState !== WebSocket.CONNECTING)) {
            console.log('TikTok Relay disconnected, attempting to reconnect...');
            connectTikTokRelay();
        }
    }, 60000); // 60 seconds
}

initTikTokRelay();

function scrollToBottom() {
    const chatTextArea = document.querySelector(".chat-text-area");
    requestAnimationFrame(() => {
        chatTextArea.scrollTo({
            top: chatTextArea.scrollHeight,
            behavior: "smooth",
        });
    });
}

client.on("Twitch.ChatMessage", (data) => {
    console.log("Twitch ChatMessage data:", data); // Log the data
    const messageData = data.data.message ?? {};
    const userName =
        messageData.displayName ?? messageData.name ?? "";
    const chatMessage = data.data.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    console.log("data.data.text:", data.data.text);
    console.log("data.data.parts:", data.data.parts);

    const messageElement = document.createElement("div");
    messageElement.classList.add("chatMessage");
    const twitchColor = getUserColor(userName);
    const twitchMsg = applyHolidayEffects(chatMessage);
    messageElement.innerHTML = `<span class="username twitch">[Twitch]</span> <span style="color:${twitchColor}">${userName}:</span> ${twitchMsg}`;
    chatLog.appendChild(messageElement);

    // Smooth scroll to the bottom of the chat text area
    const chatTextArea = document.querySelector(".chat-text-area");
    requestAnimationFrame(() => {
        chatTextArea.scrollTo({
            top: chatTextArea.scrollHeight,
            behavior: "smooth",
        });
    });
});

client.on("YouTube.Message", (data) => {
    console.log("YouTube Message data:", data); // Log the data
    const userName = data.data.user.name;
    // Filter out emojis and only get text parts
    const chatMessage = data.data.parts
        .filter((part) => part.text && !part.emoji) // Only include parts with text but no emoji property
        .map((part) => part.text)
        .join("");

    const messageElement = document.createElement("div");
    messageElement.classList.add("chatMessage");
    const youtubeColor = getUserColor(userName);
    const youtubeMsg = applyHolidayEffects(chatMessage);
    messageElement.innerHTML = `<span class="username youtube">[YouTube]</span> <span style="color:${youtubeColor}">${userName}:</span> ${youtubeMsg}`;
    chatLog.appendChild(messageElement);

    // Smooth scroll to the bottom of the chat text area
    const chatTextArea = document.querySelector(".chat-text-area");
    requestAnimationFrame(() => {
        chatTextArea.scrollTo({
            top: chatTextArea.scrollHeight,
            behavior: "smooth",
        });
    });
});

// Handle window resize to ensure proper alignment
let resizeTimeout;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const chatTextArea =
            document.querySelector(".chat-text-area");
        if (chatTextArea) {
            // Maintain scroll position relative to bottom after resize
            requestAnimationFrame(() => {
                chatTextArea.scrollTop = chatTextArea.scrollHeight;
            });
        }
    }, 150);
});

// Handle orientation change for mobile devices
window.addEventListener("orientationchange", () => {
    setTimeout(() => {
        const chatTextArea =
            document.querySelector(".chat-text-area");
        if (chatTextArea) {
            requestAnimationFrame(() => {
                chatTextArea.scrollTop = chatTextArea.scrollHeight;
            });
        }
    }, 300);
});

// ── Friday the 13th: Ghost Messages ─────────────────────────────────────────
if (window.HOLIDAY && window.HOLIDAY.friday13) {
    const GHOST_USERS = [
        '👻 Sp00ky_G', '💀 B0nes', '🕷️ Cr4wler', '🦇 DarkWing',
        '☠️ Death', '🕸️ W3bsT3r', '👁️ WatcherX', '🩸 BloodM00n',
        '😱 Shriek', '🌑 VoidWalker',
    ];
    const GHOST_MESSAGES = [
        'Did you hear that?',
        "I've been watching you...",
        'Do not turn around.',
        'The lights are going out soon.',
        'Is anyone else cold right now?',
        'Who invited me? Nobody does.',
        'I died in this chat once before.',
        'The 13th comes for us all.',
        'I am still here.',
        'Something is behind you.',
        "You shouldn't have opened this chat.",
        'They never found the body.',
        'Run.',
        'HEHEHEHE',
        '...did that just move?',
        'The static is getting louder.',
        'I can see you',
        'I\'m right behind you.',
        'I\'m in your walls.',
    ];

    function sendGhostMessage() {
        const user = GHOST_USERS[Math.floor(Math.random() * GHOST_USERS.length)];
        const msg = GHOST_MESSAGES[Math.floor(Math.random() * GHOST_MESSAGES.length)];
        addLogMessage(
            `<span class="username" style="color:#cc2222">${user}:</span> <em>${msg}</em>`,
            'chatMessage'
        );
        // Schedule next ghost between 45 and 150 seconds from now
        const nextIn = (300 + Math.floor(Math.random() * 106)) * 1000;
        setTimeout(sendGhostMessage, nextIn);
    }

    // First ghost appears 30–90 seconds after page load
    const firstDelay = (30 + Math.floor(Math.random() * 61)) * 1000;
    setTimeout(sendGhostMessage, firstDelay);
}
