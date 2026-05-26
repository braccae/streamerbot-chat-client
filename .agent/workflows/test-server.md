---
description: Start the local test chat server and open the frontend + dashboard in Chrome
---

# Start Local Test Chat Server

The test chat server emulates both the Streamerbot WebSocket backend (port 18080) and the TikTok relay backend (port 8081), plus serves the frontend and dashboard via HTTP (port 8082).

## Steps

// turbo-all

1. Kill any existing processes on the required ports to avoid conflicts:
```bash
lsof -ti:18080,8081,8082 | xargs kill -9 2>/dev/null; echo "Ports cleared"
```

2. Start the test server in the background using `run_command` with `WaitMsBeforeAsync: 2000`. The command is:
```bash
cd /home/pants/Projects/stream_projects/streamerbot-chat-client && node testchat/test-server.js
```
Verify the output contains `Test Chat Server Running`. If it fails with a port-in-use error, re-run step 1 and retry.

3. Use the `browser_subagent` tool to open the **chat frontend** in the browser:
   - URL: `http://localhost:8082/index.html?local=true`
   - Task: Open the URL and wait for the page to load. Capture a screenshot. Return a description of what you see.
   - The page should show a pixel-art scroll with status dots in the top-right area. Both status dots (Streamer.Bot and TikTok) should be **green** indicating successful WebSocket connections.

4. Use the `browser_subagent` tool to open the **test dashboard** in a new tab:
   - URL: `http://localhost:8082/testchat/`
   - Task: Open the URL, capture a screenshot, and verify the dashboard loads with platform tabs, message input, and status indicators.
   - The status section should show **1 client** for both Streamerbot WS and TikTok Relay WS (green dots).

## Verifying Connections

After both pages are open, use `read_url_content` on `http://localhost:8082/status` to check the connected client counts. Expected response:
```json
{"streamerbot":{"clients":1},"tiktok":{"clients":1}}
```

## Stopping the Server

Use `run_command` to kill the server:
```bash
lsof -ti:8082 | xargs kill -9
```

## URLs Reference

| URL | Purpose |
|-----|---------|
| `http://localhost:8082/index.html?local=true` | Chat frontend in local test mode |
| `http://localhost:8082/index.html?local=true&transparent=true` | Chat frontend, transparent overlay mode |
| `http://localhost:8082/testchat/` | Test dashboard (message sender UI) |
| `http://localhost:8082/status` | JSON status endpoint (client counts) |
| `http://localhost:8082/env` | Environment endpoint (TikTok relay URL) |
