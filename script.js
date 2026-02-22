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
        addLogMessage(
            "Connected to Streamer.bot WebSocket.",
            "systemMessage green",
        );
    },
    onDisconnect: () => {
        addLogMessage(
            "WebSocket disconnected. Attempting to reconnect...",
            "systemMessage red",
        );
    },
    onError: (error) => {
        console.error("WebSocket error:", error);
        addLogMessage(
            "WebSocket error occurred. Check browser console for details.",
            "systemMessage red",
        );
    },
});

// TikTok Relay Connection
const tiktokRelay = new WebSocket('ws://localhost:8081');

tiktokRelay.onopen = () => {
    console.log('Connected to TikTok Relay server');
};

tiktokRelay.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'info') {
        addLogMessage(data.message, "systemMessage blue");
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

addLogMessage(
    "Attempting to connect to Streamer.bot WebSocket...",
    "systemMessage",
);

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
