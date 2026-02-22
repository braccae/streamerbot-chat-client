# Streamerbot Chat Client & TikTok Relay

A lightweight chat client interface designed to receive events from Streamer.bot (Twitch/YouTube) and a custom TikTok Live backend relay. The frontend is built with vanilla HTML/CSS/JS and feature a retro pixel-art scroll and a transparent OBS-friendly overlay mode.

## Architecture
1. **Frontend**: Static site deployed to Cloudflare Pages.
2. **TikTok Relay Server**: A Node.js application containerized via Docker/Podman that connects to TikTok live chat using `tiktok-live-connector` and broadcasts via WebSockets (`ws`).

## 1. Setup the Frontend (Cloudflare Pages)

The frontend connects to Streamer.bot locally (`ws://127.0.0.1:8080`) and to the TikTok relay server. It uses a Cloudflare Pages Function (`/env`) to dynamically route to the TikTok backend.

### Local Development
To test the frontend locally with hot-reloading:

```bash
# Install Wrangler dependency if you haven't already
npm install

# Run the local Wrangler preview server
npm run pages:dev
```
Access the client at:
- Regular View: `http://localhost:8788/`
- Transparent View (For OBS): `http://localhost:8788/transparent`

### Deployment
To deploy the frontend to Cloudflare Pages:

```bash
npm run pages:deploy
```

**Important**: In your Cloudflare Pages dashboard, set the `TIKTOK_BACKEND` environment variable to point to your hosted relay server (e.g., `wss://ultimateshadestiktokbackend.pants.place`).

## 2. Setup the TikTok Relay Server (Backend)

The TikTok backend relies on Docker or Podman to run in the cloud independently. It uses a multi-stage Dockerfile to compile native dependencies on architectures like `arm64`.

### Building the Image
You can build the container locally using Podman (or Docker):

```bash
podman build -t tiktok-relay .
```

Alternatively, the included GitHub Actions workflow (`build-relay.yml`) automatically builds and pushes the image to GitHub Container Registry (GHCR) for both `amd64` and `arm64` whenever you push to the `main` branch.

### Running the Container
When running the container, you must provide your TikTok username via the `TIKTOK_USERNAME` environment variable.

```bash
podman run -d -p 8081:8081 -e TIKTOK_USERNAME=@ultimateshades tiktok-relay
```

By default, the relay server broadcasts on port `8081`. You can then set up a reverse proxy to route secure `wss://` traffic to this container.
