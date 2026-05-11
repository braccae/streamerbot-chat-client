---
description: Verify CSS/JS/HTML changes to the chat frontend using the test server and browser
---

# Verify Frontend Changes

Use this workflow after making changes to `index.html`, `script.js`, or `style.css` to visually confirm the results. Uses the Antigravity `browser_subagent` and `run_command` tools.

> **Prerequisite:** The test server must be running. Use the `/test-server` workflow to start it. The test server serves files directly from the project root, so any saved changes are reflected immediately on browser refresh — no build step needed.

## Steps

// turbo-all

1. **Ensure the test server is running.** Use `read_url_content` on `http://localhost:8082/status`. If it fails, start the server per the `/test-server` workflow.

2. **Send test messages from all platforms** using `run_command` (safe to auto-run):
```bash
curl -s -X POST http://localhost:8082/send -H "Content-Type: application/json" \
  -d '{"platform":"twitch","username":"TwitchUser","message":"Testing Twitch rendering"}'
curl -s -X POST http://localhost:8082/send -H "Content-Type: application/json" \
  -d '{"platform":"youtube","username":"YouTubeUser","message":"Testing YouTube rendering"}'
curl -s -X POST http://localhost:8082/send -H "Content-Type: application/json" \
  -d '{"platform":"tiktok","username":"TikTokUser","message":"Testing TikTok rendering"}'
curl -s -X POST http://localhost:8082/send -H "Content-Type: application/json" \
  -d '{"platform":"tiktok-gift","username":"GiftUser","giftName":"Rose","giftCount":3}'
```

3. **Open the frontend and capture a screenshot** using `browser_subagent`:
   - URL: `http://localhost:8082/index.html?local=true`
   - Task the subagent to: open the URL, wait for it to load, capture a screenshot, and describe what it sees.
   - **Check these items in the screenshot:**
     - Messages render with correct platform tags (`[Twitch]`, `[YouTube]`, `[TikTok]`)
     - Platform tag colors: purple (Twitch), red (YouTube), teal (TikTok)
     - Username colors are assigned and consistent
     - Gift messages appear as italic green system messages
     - Scroll background SVG renders correctly
     - Status indicators (top-right of scroll) show green dots

4. **Test transparent mode** using `browser_subagent`:
   - URL: `http://localhost:8082/index.html?local=true&transparent=true`
   - Verify: scroll background is hidden, text has black outline shadow, status bar is fixed to top-right corner.

5. **(Optional) Test at different sizes.** Use `browser_subagent` to resize the browser window to check responsive behavior:
   - Mobile: width 375, height 667
   - Tablet: width 768, height 1024
   - Desktop: width 1280, height 720

## What to Check After Specific Changes

### CSS Changes (`style.css`)
- Use `browser_subagent` to open/refresh the page and take a screenshot
- Compare layout, colors, spacing against expectations
- Resize the browser via subagent to test responsive breakpoints

### JavaScript Changes (`script.js`)
- Use `browser_subagent` to refresh the page
- Send test messages from each platform via `run_command` + curl
- Use `browser_subagent` to capture a screenshot after messages arrive
- Instruct the subagent to check the browser console/DOM for errors

### HTML Changes (`index.html`)
- Use `browser_subagent` to refresh and verify structure
- Confirm all expected elements are present (status container, scroll SVG, chat area)

## File Locations

| File | Purpose | Served at |
|------|---------|-----------|
| `index.html` | Chat frontend HTML | `/index.html` |
| `script.js` | Chat logic + WS connections | `/script.js` |
| `style.css` | Frontend styling | `/style.css` |
| `testchat/index.html` | Test dashboard UI | `/testchat/` |
| `testchat/test-server.js` | Test backend server | N/A (run with `node`) |
