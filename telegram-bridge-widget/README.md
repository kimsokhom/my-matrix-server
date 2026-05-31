# Telegram Bridge Widget

A Matrix room widget that gives a friendly screen for the [mautrix-telegram](https://docs.mau.fi/bridges/go/telegram/index.html) bridge. Instead of typing raw `!tg` commands in a chat, the user gets a simple UI to connect their Telegram account, see their Telegram contacts, find people, and start chats — all from inside Element Web **or** a normal web browser.

---

## Why This Exists

The mautrix-telegram bridge is strong but technical. A new user must know commands like:

```
!tg login
+85512345678
12345
```

This widget replaces that with a clean UI: a login wizard, a contact list, and a search box. Now non-technical users can use the bridge easily.

---

## What This Widget Can Do

| Feature | What it does |
| --- | --- |
| **Connection status** | A live badge shows if Telegram is connected or not. |
| **Login wizard** | Lets the user pick a login method, then guides them step by step. |
| **Three login methods** | **Phone number**, **QR code**, and **Bot token**. |
| **Profile card** | Shows the connected Telegram name and phone number. |
| **My Contacts** | Lists your Telegram contacts; open a chat with any of them. |
| **Find User** | Searches Telegram for a person and starts a direct message. |
| **Disconnect** | Logs out from Telegram, with a confirm question first. |
| **Works in browser and Element** | Detects the user automatically in Element, or asks once in a browser. |

> **Why "Contacts" and not "Chats"?** The bridge's API only gives a **contacts** list — it has no
> "chat list" endpoint. Your real Telegram chats are bridged as normal **Matrix rooms**, so they
> already show up in Element's room list. The widget's job here is to let you *find a contact and
> start a chat*, so the button is labelled **My Contacts**.

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| UI framework | [Lit](https://lit.dev/) v3 (Web Components) |
| Matrix integration | [matrix-widget-api](https://github.com/matrix-org/matrix-widget-api) v1.17 |
| QR codes | [qrcode](https://www.npmjs.com/package/qrcode) v1.5 |
| Build tool | [Vite](https://vitejs.dev/) v7 |
| Language | Vanilla JavaScript (ES modules) |
| Deployment | Docker + Railway (`serve` static file server) |

---

## The Bug We Found and Fixed (Important)

Before this work, the widget showed two errors:

1. **"Bridge returned 404 on GET /login"** when the user clicked *Connect Telegram Account*.
2. **"Not connected"** even when the Telegram account was really connected.

### What people thought the problem was

The first idea was: *"The bridge does not have a login API, so we must build an extra helper service (`telegram-login-adapter`) to add it."* That helper used a Synapse admin token and read the bot's text messages. It was risky and easy to break.

### What the real problem was

We tested the **live bridge** directly and found the truth: **the bridge does have a full login API.** The widget was just calling the **wrong URL paths.**

The bridge uses the newer **mautrix-go bridgev2** style. In this style the login routes are *nested*, like `/login/flows` and `/login/start/...`. But the widget was calling a flat path `/login`, which does not exist — so the bridge answered **404 Not Found**.

Proof from the live bridge:

| What the widget called | Result | The correct path | Result |
| --- | --- | --- | --- |
| `GET /v3/login` | **404** Not Found | `GET /v3/login/flows` | **200** OK ✅ |
| `GET /v3/portals` | **404** Not Found | `GET /v3/contacts` | **200** OK ✅ |

The "Not connected" bug had a second cause: the widget read the wrong field from the status response. The bridge returns the account inside a `logins` list, but the old code looked for a field called `telegram`, which does not exist.

### What we changed

- We fixed **all** the API paths to match the real bridgev2 API.
- We fixed the status check to read the `logins` list.
- We **deleted** the `telegram-login-adapter` helper service. It is not needed, because the bridge already does login by itself. This also removes the security risk of the admin token.

So the final design is simple and safe:

```
Browser  or  Element Web (iframe)
   └── telegram-bridge-widget
         └── fetch() → /_matrix/provision/v3/...
               └── mautrix-telegram bridge (Railway)   ← no helper service in the middle
```

---

## How the Login Wizard Works Now

The bridge can grow or change its login steps in the future. To stay safe, the widget does **not** hard-code "phone, then code, then password". Instead it is **generic**: it just follows whatever steps the bridge sends back. This is called a *step engine*.

The flow is:

1. **Get the methods.** `GET /login/flows` returns the list: phone, QR code, bot token. The widget shows them as buttons.
2. **Start one method.** When the user clicks a method, the widget calls `POST /login/start/{method}`. The bridge replies with the first **step**.
3. **Follow the steps.** Every step has a `type`. The widget reads the type and shows the right screen:
   - `user_input` → show one text box for each field the bridge asks for (for example a phone number, a code, or a 2FA password). Field types like `phone_number`, `password`, and `2fa_code` choose the right input style.
   - `display_and_wait` → show a **QR code** (drawn from the data the bridge sends) and wait for the user to scan it with their phone.
   - `complete` → login is done. The widget refreshes the status and goes back to Home.
4. **Send the answer.** For input steps the widget calls `POST /login/step/{loginId}/{stepId}/{type}` with the values. The bridge then sends the next step, and the loop repeats until `complete`.

Because of this design, **all three methods use the same code**. If the bridge adds a new field later, the widget will still show it correctly.

---

## How the User Is Identified (and why it's secure)

> Full details in [SECURITY.md](./SECURITY.md). Short version below.

The widget never holds the provisioning secret and never decides *which* Matrix
user it acts as. A same-origin **auth proxy** (`server.js`) does both:

1. **In production (inside Element)** — the widget asks Element for a **Matrix
   OpenID token** and sends it to the proxy. The proxy verifies the token against
   the homeserver, derives the real `user_id` from it, injects the secret, and
   forwards to the bridge. A client **cannot** specify someone else's `user_id` —
   the proxy ignores it and uses the verified one. This blocks impersonation.
2. **Opened outside Element (production)** — there is no verified identity, so the
   widget shows an **"Open in Element"** message. It does *not* accept a typed
   Matrix ID (that would be unauthenticated).
3. **Local development** — there is no Element host to issue a token, so dev falls
   back to a manually-entered Matrix ID and the Vite dev proxy (which injects the
   secret server-side). This path is **compiled out of production builds**.

To use a different account, log into Element as that account — the widget follows
automatically. There is intentionally no in-widget account switcher.

> When you open the widget outside Element, the console shows a line like *"Not ready or unknown widget ID"*. This is **normal and harmless** — it just means Element is not there to answer. Any `contentscript.js` warnings come from browser extensions (like MetaMask) and are not from this widget.

### Working inside Element's sandbox

Element runs the widget in a **sandboxed iframe** that blocks some normal browser features. The widget is built to work around this so every button works in both places:

- **Disconnect** uses an in-widget confirm dialog, not `window.confirm()` (which the sandbox blocks — this was an earlier bug where the button did nothing).
- **Opening a chat** asks Element to navigate (the `org.matrix.msc2931.navigate` capability), and falls back to a normal new tab in a plain browser, instead of `window.open()` (also blocked in the sandbox).

---

## Environment Variables

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Side | Description | Example |
| --- | --- | --- | --- |
| `VITE_BRIDGE_URL` | client | Leave **empty** so the client calls the same-origin proxy. | *(empty)* |
| `PROVISIONING_SECRET` | **server** | The `provisioning.shared_secret` from the bridge `config.yaml`. Never bundled into the client. | `abc123...` |
| `BRIDGE_INTERNAL_URL` | **server** | Bridge URL the proxy forwards to — use the **private** network URL. | `http://mautrix-telegram.railway.internal:29317` |
| `HOMESERVER_NAME` | **server** | Homeserver to verify OpenID tokens against (also pinned). | `synapse-….up.railway.app` |
| `VITE_MATRIX_USER_ID` | client (dev) | Dev-only fallback Matrix ID; ignored in production. | `@you:server.com` |

> Note the `VITE_` prefix: only those variables are compiled into the browser
> bundle. `PROVISIONING_SECRET` has **no** prefix on purpose, so it stays
> server-side. See [SECURITY.md](./SECURITY.md).

### Finding the provisioning secret

```bash
# On Railway, open a shell in the mautrix-telegram service and run:
grep shared_secret /etc/mautrix-telegram/config.yaml
```

Or set a fixed value yourself in the bridge config and use the same value here.

---

## Local Development

```bash
# 1. Install dependencies (now includes qrcode)
npm install

# 2. Create your .env file
cp .env.example .env
# edit .env with your bridge URL and secret

# 3. Start the dev server
npm run dev
```

The widget runs at `http://localhost:5173`.

To test fast without a Telegram account, open the widget and type the Matrix ID of a user that is **already** connected. You should see the green **Connected** badge, the profile, and the contact list under **My Chats**.

---

## Production Build

```bash
npm run build      # output goes to dist/
npm run preview    # check the build locally
```

---

## Docker Deployment (Railway)

The Dockerfile uses a two-stage build: Node 20 builds the static bundle, then the
runtime stage runs the **auth proxy** (`server.js`), which serves `dist/` *and*
verifies/forwards provisioning calls on `$PORT`.

```bash
docker build -t telegram-bridge-widget .

docker run -p 8080:8080 \
  -e PORT=8080 \
  -e PROVISIONING_SECRET=your-secret \
  -e BRIDGE_INTERNAL_URL=http://mautrix-telegram.railway.internal:29317 \
  -e HOMESERVER_NAME=synapse-….up.railway.app \
  telegram-bridge-widget
```

On Railway, set `PROVISIONING_SECRET`, `BRIDGE_INTERNAL_URL`, and `HOMESERVER_NAME`
as service variables (leave `VITE_BRIDGE_URL` empty). Railway gives `PORT`
automatically. **Important:** keep the bridge's provisioning endpoint on the
private network only — see [SECURITY.md](./SECURITY.md).

---

## Adding the Widget to Element Web

1. Open the room in Element Web.
2. Click **Room info** (ⓘ) → **Add widgets, bridges & bots**.
3. Choose **Custom widget**.
4. Fill in:
   - **Name:** `Telegram Bridge`
   - **URL:** `https://your-widget.up.railway.app`
   - **Type:** Custom
5. Click **Add**.

Inside Element the user is detected automatically (no need to add `?user_id=` to the URL).

---

## Provisioning API Reference (correct paths)

The widget uses these mautrix-go **bridgev2** endpoints. The browser calls them on the same origin (`/_matrix/provision/*`) and sends a Matrix OpenID token (`Authorization: Bearer <token>` + `X-Matrix-Server-Name`). The auth proxy verifies the token, then forwards to the bridge with `Authorization: <PROVISIONING_SECRET>` and the **verified** `?user_id=@user:server`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/_matrix/provision/v3/whoami` | Check status; read the `logins` list |
| `GET` | `/_matrix/provision/v3/login/flows` | List login methods (phone / QR / bot) |
| `POST` | `/_matrix/provision/v3/login/start/{flowID}` | Start one login method |
| `POST` | `/_matrix/provision/v3/login/step/{loginID}/{stepID}/{type}` | Send a step answer (input or wait) |
| `POST` | `/_matrix/provision/v3/login/cancel/{loginID}` | Cancel a login in progress |
| `POST` | `/_matrix/provision/v3/logout/{loginID}` | Disconnect the Telegram account |
| `GET` | `/_matrix/provision/v3/contacts` | List Telegram contacts (the "chats") |
| `POST` | `/_matrix/provision/v3/search_users` | Search Telegram by a text query |
| `GET` | `/_matrix/provision/v3/resolve_identifier/{id}` | Resolve a username/phone to a user |
| `POST` | `/_matrix/provision/v3/create_dm/{id}` | Start a direct message with a user |

> If your bridge version changes a path, edit the `API` object at the top of [src/telegram-widget.js](src/telegram-widget.js). It is the single place where all paths live.

---

## Folder Structure

The widget used to live in one large file. It is now split into small modules so it
is easier to read, review, and maintain. The component file holds only state and UI;
everything else has its own file.

```
telegram-bridge-widget/
├── src/
│   ├── config.js            ← env vars + constants (BRIDGE_URL, VIEWS, STORAGE_KEY)
│   ├── api.js               ← API path map + BridgeClient (auth, user_id, fetch)
│   ├── icons.js             ← modern SVG icon set (ICONS map)
│   ├── styles.js            ← all CSS, built on design tokens (see below)
│   └── telegram-widget.js   ← main Lit component (state, step engine, render)
├── public/
├── index.html
├── package.json             ← includes the qrcode dependency
├── Dockerfile
├── .gitignore
└── .env.example             ← documents the 2 env vars
```

### How the modules fit together

- **`config.js`** — the only place build-time settings live.
- **`api.js`** — `BridgeClient` wraps every bridge call. It adds the `Authorization`
  secret and the `?user_id=` query for you, and returns `{ ok, status, data }` so the
  component just checks the result. Change a path once in the `API` map if the bridge
  version changes.
- **`icons.js`** — clean outline SVG icons that inherit color from CSS (`currentColor`).
- **`styles.js`** — all styling. It starts with **design tokens** (CSS custom
  properties for spacing, radius, color, type, and shadow). Change a token once and the
  whole UI updates. The layout is responsive (the action buttons reflow on small
  screens), has keyboard focus rings, and respects the user's reduced-motion setting.
- **`telegram-widget.js`** — imports the four files above and contains only the widget
  logic and the screens (Home, Login wizard, Contacts, Search).
