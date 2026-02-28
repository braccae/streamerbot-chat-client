const chatLog = document.getElementById("chatLog");

// Check for transparent route
if (window.location.pathname === '/transparent') {
    document.body.classList.add('transparent-mode');
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
async function initTikTokRelay() {
    let backendUrl = 'ws://127.0.0.1:8081'; // default

    try {
        const response = await fetch('/env');
        if (response.ok) {
            const data = await response.json();
            if (data.backendUrl) {
                backendUrl = data.backendUrl;
            }
        }
    } catch (e) {
        console.warn('Could not fetch /env, using default ws://127.0.0.1:8081', e);
    }

    console.log(`Attempting to connect to TikTok relay at: ${backendUrl}`);
    const tiktokRelay = new WebSocket(backendUrl);

    let pingInterval;

    tiktokRelay.onopen = () => {
        console.log('Connected to TikTok Relay server');
        // Start keepalive ping
        pingInterval = setInterval(() => {
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
            messageElement.innerHTML = `<span class="username tiktok">[TikTok] ${data.user.name}:</span> ${data.message}`;
            chatLog.appendChild(messageElement);

            scrollToBottom();
        } else if (data.type === 'tiktok-gift') {
            addLogMessage(`🎁 ${data.user.name} sent ${data.gift} x${data.count}`, "systemMessage green");
        }
    };

    tiktokRelay.onerror = (error) => {
        console.error('TikTok Relay error:', error);
    };

    tiktokRelay.onclose = () => {
        clearInterval(pingInterval);
        const tiktokStatus = document.getElementById('tiktok-status');
        if (tiktokStatus) {
            tiktokStatus.classList.remove('connected');
            tiktokStatus.classList.add('disconnected');
        }
    };
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
    messageElement.innerHTML = `<span class="username">[Twitch] ${userName}:</span> ${chatMessage}`;
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
    messageElement.innerHTML = `<span class="username youtube">[YouTube] ${userName}:</span> ${chatMessage}`;
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
