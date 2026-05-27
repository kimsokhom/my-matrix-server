# Telegram Bridge Widget

A Matrix room widget that provides a friendly graphical interface for the [mautrix-telegram](https://docs.mau.fi/bridges/python/telegram/index.html) bridge. Instead of typing raw `!tg` commands in a chat room, users get a clean step-by-step UI to connect their Telegram account, browse bridged chats, and find other Telegram users — all from inside Element Web.

---

## Why This Exists

The mautrix-telegram bridge is powerful but technical. New users must know commands like:

```
!tg login
+85512345678
12345
!tg sync chats
!tg pm @username
```

This widget replaces that flow with a proper UI — a login wizard, a chat list, and a search panel — making the bridge accessible to non-technical users.

---

## Features

| Feature                     | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Connection status** | Live badge showing whether Telegram is connected                             |
| **Login wizard**      | Step-by-step: phone number → verification code → 2FA password (if enabled) |
| **Profile card**      | Displays connected Telegram username and phone number                        |
| **My Chats**          | Lists all bridged Telegram portals with direct "Open" links                  |
| **Sync chats**        | One-click refresh to pull the latest portals from the bridge                 |
| **Find User**         | Search any Telegram user by `@username` or phone number and start a DM     |
| **Disconnect**        | Safely log out from Telegram with a confirmation prompt                      |

---

## Tech Stack

| Layer              | Choice                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| UI framework       | [Lit](https://lit.dev/) v3 (Web Components)                                |
| Matrix integration | [matrix-widget-api](https://github.com/matrix-org/matrix-widget-api) v1.17 |
| Build tool         | [Vite](https://vitejs.dev/) v7                                             |
| Language           | Vanilla JavaScript (ES modules)                                         |
| Deployment         | Docker + Railway (`serve` static file server)                         |

> Same stack as the postmoogle widget in this project — consistent pattern across all widgets.

---

## How It Works

The widget communicates with the mautrix-telegram bridge's built-in **Provisioning REST API** (`/_matrix/provision/v3/`). This means:

- No message parsing — responses are clean JSON, not bot text
- Authentication uses the bridge's `provisioning.shared_secret`
- All actions (login, logout, portal list, DM creation) go through dedicated REST endpoints

```
Element Web (iframe)
  └── telegram-bridge-widget
        └── fetch() → /_matrix/provision/v3/...
              └── mautrix-telegram bridge (Railway)
```

---

## Folder Structure

```
telegram-bridge-widget/
├── src/
│   ├── telegram-widget.js   ← main Lit component (~500 lines)
│   └── index.css            ← minimal global reset
├── public/
│   └── manifest.json
├── index.html
├── package.json
├── Dockerfile               ← identical pattern to postmoogle
├── .gitignore
└── .env.example             ← documents the 2 env vars
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in both values:

```bash
cp .env.example .env
```

| Variable                     | Description                                                                | Example                                         |
| ---------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `VITE_BRIDGE_URL`          | Public URL of your mautrix-telegram bridge (no trailing slash)             | `https://mautrix-telegram-xyz.up.railway.app` |
| `VITE_PROVISIONING_SECRET` | The `provisioning.shared_secret` value from the bridge's `config.yaml` | `abc123...`                                   |

### Finding the provisioning secret

The bridge config has `shared_secret: generate` by default, which means the bridge auto-generates a random secret on first run. To get its value:

**Option A — Read from the running container:**

```bash
# On Railway, open a shell into the mautrix-telegram service and run:
grep shared_secret /etc/mautrix-telegram/config.yaml
```

**Option B — Set a fixed secret yourself:**

In your bridge's `config.yaml` (or Railway env vars), replace `generate` with a value of your choice:

```yaml
provisioning:
    shared_secret: "my-fixed-secret-value"
```

Then use that same value as `VITE_PROVISIONING_SECRET`.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env with your bridge URL and provisioning secret

# 3. Start the dev server
npm run dev
```

The widget will be available at `http://localhost:5173`.

> **Note:** When running outside Element Web, the Matrix Widget API will log a warning — this is expected. All bridge API calls still work normally for development and testing.

---

## Production Build

```bash
npm run build
# Output goes to dist/
```

Preview the production build locally:

```bash
npm run preview
```

---

## Docker Deployment (Railway)

The Dockerfile uses a two-stage build:

1. **Builder** — Node 20 installs dependencies and runs `npm run build`
2. **Runtime** — serves the `dist/` folder using the `serve` package on `$PORT`

```bash
# Build the image
docker build -t telegram-bridge-widget .

# Run locally
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e VITE_BRIDGE_URL=https://your-bridge.railway.app \
  -e VITE_PROVISIONING_SECRET=your-secret \
  telegram-bridge-widget
```

> On Railway, set `VITE_BRIDGE_URL` and `VITE_PROVISIONING_SECRET` as environment variables in the service settings. Railway automatically provides `PORT`.

---

## Adding the Widget to Element Web

Once deployed, add the widget to any Matrix room (typically the bridge management room — the DM with `@telegrambot`):

1. Open the room in Element Web
2. Click **Room info** (ⓘ) → **Add widgets, bridges & bots**
3. Select **Custom widget**
4. Fill in:
   - **Name:** `Telegram Bridge`
   - **URL:** `https://your-widget.up.railway.app`
   - **Type:** Custom
5. Click **Add**

The widget will appear in the right panel of the room.

---

## Provisioning API Reference

The widget uses these endpoints on the mautrix-telegram bridge:

| Method     | Path                                             | Purpose                                         |
| ---------- | ------------------------------------------------ | ----------------------------------------------- |
| `GET`    | `/_matrix/provision/v3/whoami`                 | Check login status                              |
| `POST`   | `/_matrix/provision/v3/login/new`              | Start Telegram login flow                       |
| `POST`   | `/_matrix/provision/v3/login/{id}/step`        | Submit login step (phone / code / 2FA)          |
| `DELETE` | `/_matrix/provision/v3/login/{id}`             | Cancel in-progress login                        |
| `POST`   | `/_matrix/provision/v3/logout`                 | Disconnect Telegram account                     |
| `GET`    | `/_matrix/provision/v3/portals`                | List bridged Telegram chats                     |
| `GET`    | `/_matrix/provision/v3/resolve_identifier/{q}` | Resolve `@username` or phone to Telegram user |
| `POST`   | `/_matrix/provision/v3/pm`                     | Create a DM portal with a Telegram user         |

All requests are authenticated with the header:

```
Authorization: <VITE_PROVISIONING_SECRET>
```

> **Path note:** If your bridge version uses a different base path (e.g., `v1` instead of `v3`), update the `API` constants at the top of [src/telegram-widget.js](src/telegram-widget.js).

---
