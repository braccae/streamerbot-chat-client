---
description: Send fake chat messages via the test server HTTP API to populate the frontend
---

# Send Test Messages

The test server exposes `POST http://localhost:8082/send` to inject fake chat messages into the frontend.

> **Prerequisite:** The test server must be running. Use the `/test-server` workflow to start it.

## Sending Messages

Use the `run_command` tool with `curl` to send messages. All commands are safe to auto-run.

### Send One Message Per Platform

```bash
# Twitch
curl -s -X POST http://localhost:8082/send \
  -H "Content-Type: application/json" \
  -d '{"platform":"twitch","username":"TwitchTester","message":"Hello from Twitch!"}'

# YouTube
curl -s -X POST http://localhost:8082/send \
  -H "Content-Type: application/json" \
  -d '{"platform":"youtube","username":"YouTubeTester","message":"Hello from YouTube!"}'

# TikTok
curl -s -X POST http://localhost:8082/send \
  -H "Content-Type: application/json" \
  -d '{"platform":"tiktok","username":"TikTokTester","message":"Hello from TikTok!"}'
```

### Send a TikTok Gift

```bash
curl -s -X POST http://localhost:8082/send \
  -H "Content-Type: application/json" \
  -d '{"platform":"tiktok-gift","username":"BigSpender","giftName":"Rose","giftCount":5}'
```

### Burst: All Platforms at Once

```bash
for plat in twitch youtube tiktok; do
  curl -s -X POST http://localhost:8082/send \
    -H "Content-Type: application/json" \
    -d "{\"platform\":\"$plat\",\"username\":\"${plat}Tester\",\"message\":\"Test from $plat at $(date +%T)\"}"
  sleep 0.3
done
```

## Verifying Messages Appeared

After sending messages, use the `browser_subagent` tool to:
1. Navigate to (or refresh) `http://localhost:8082/index.html?local=true`
2. Capture a screenshot
3. Verify that the sent messages are visible in the chat area

### Expected Display Per Platform

| Platform | Prefix | Prefix Color | Message Style |
|----------|--------|-------------|---------------|
| Twitch | `[Twitch]` | Purple (#6a0dad) | Normal text |
| YouTube | `[YouTube]` | Red (#d32f2f) | Normal text |
| TikTok | `[TikTok]` | Teal (#10908c) | Normal text |
| TikTok Gift | — | Green italic | `🎁 username sent GiftName x5` |

## API Reference

### `POST /send`

Body (JSON):
```json
{
  "platform": "twitch|youtube|tiktok|tiktok-gift",
  "username": "string",
  "message": "string",
  "giftName": "string (tiktok-gift only)",
  "giftCount": "number (tiktok-gift only)"
}
```
Response: `{"ok": true}`

### `GET /status`

Use `read_url_content` on `http://localhost:8082/status` to check connected clients.
Response: `{"streamerbot":{"clients":N},"tiktok":{"clients":N}}`
