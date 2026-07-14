# DISPARO WINC

Dark neon SaaS platform for WhatsApp campaign operations, contact validation, dynamic personalization, queued sending, real-time logs, and analytics dashboards.

> The anti-blocking layer is implemented as a safe reputation and compliance mode: randomized delays, quiet windows, deduplication, opt-in controls, and pause/cancel actions. The project ships with pluggable adapters and simulated sending, ready to connect to WPP Connect or the Official API with real credentials.

## Public Demo

Stable public demo: https://yungwictor.github.io/DISPARO-WINC/

## Stack

- Frontend: React, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Socket.io Client
- Backend: Node.js, Express, Socket.io, SQLite, JWT, Multer
- Database: local SQLite
- Realtime: WebSocket with Socket.io
- Local deployment: Docker Compose

## Screens

- Futuristic login
- Main dashboard
- Campaign sending area
- Campaign history
- Settings
- WhatsApp connections

## Features

- JWT authentication
- Simulated WhatsApp QR Code connection
- WPP Connect / Official API provider switch
- Assisted Facebook Groups campaign section
- Assisted WhatsApp Groups campaign section with configurable queue intervals
- Online/offline session status
- Multiple-number input
- CSV upload
- Contact import
- Group import
- Number validation
- Random delay between messages
- Reputation-based safe mode
- Variables: `{nome}`, `{campo1}`, `{campo2}`, `{vencimento}`, `{plano}`
- Emoji support
- Attachments: image, video, PDF, and audio
- Sending progress bar
- Real-time logs
- Sent, failed, and waiting counters
- Pause, resume, and cancel campaign controls
- Campaign history and statistics dashboard
- Session warm-up workflow
- Toasts and subtle notification sound
- Manual Facebook Groups workflow with post copy, approval status, and group tracking
- WhatsApp Groups workflow with message copy, consent status, interval settings, and queue preparation

## Automatic Setup

Windows:

```powershell
.\install.ps1
npm run dev
```

Linux/macOS:

```bash
chmod +x install.sh
./install.sh
npm run dev
```

Open:

- Frontend: http://localhost:5173
- Backend healthcheck: http://localhost:3333/health

## Security

No environment file or secret is committed to the repository. There is no fixed default admin password in the source code.

For production, define secrets directly in your hosting environment:

```bash
JWT_SECRET="generate-a-long-unique-secret"
ADMIN_EMAIL="your-admin-email"
ADMIN_PASSWORD="generate-a-strong-password"
```

During development, if `ADMIN_PASSWORD` is not set and the database has no user yet, the backend generates a temporary password and prints it once in the terminal.

## Scripts

```bash
npm run setup        # install dependencies
npm run dev          # run frontend and backend together
npm run build        # build the frontend
npm start            # start the backend
```

Separate scripts:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

## Docker

```bash
JWT_SECRET="generate-a-long-unique-secret" ADMIN_PASSWORD="generate-a-strong-password" \
docker compose up --build
```

Services:

- `disparo-winc-api` on port `3333`
- `disparo-winc-web` on port `5173`
- Persistent volumes for SQLite and uploads

## Google Chrome Extension

The Chrome extension version is available in `chrome-extension/`.

Install locally:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `chrome-extension` folder

The public package is generated at `stable-public/disparo-winc-chrome-extension.zip`.

## CSV

The CSV can include a header row or simple rows. Expected order:

```csv
phone,nome,campo1,campo2,vencimento,plano
+5511999999999,Ana,VIP,Renewal,2026-05-20,Premium
```

You can also paste semicolon-separated rows directly into the textarea:

```txt
+5511999999999;Ana;VIP;Renewal;2026-05-20;Premium
```

## Backend

Main structure:

```txt
backend/src/config      # configuration and SQLite
backend/src/middleware  # auth, security, and error handling
backend/src/routes      # REST API
backend/src/services    # queue, socket, and WhatsApp adapter
backend/src/utils       # validation and template helpers
```

Main endpoints:

```txt
POST /api/auth/login
GET  /api/stats
GET  /api/whatsapp/session
POST /api/whatsapp/connect
POST /api/contacts/validate
POST /api/campaigns
POST /api/campaigns/:id/start
POST /api/campaigns/:id/pause
POST /api/campaigns/:id/resume
POST /api/campaigns/:id/cancel
```

## Real WhatsApp Integration

The file `backend/src/services/whatsappService.js` centralizes message delivery.

- For WPP Connect, provide `WPP_CONNECT_URL` and `WPP_CONNECT_TOKEN`.
- For the Official API, provide `WHATSAPP_OFFICIAL_TOKEN`, `WHATSAPP_OFFICIAL_PHONE_ID`, and `WHATSAPP_OFFICIAL_BUSINESS_ID`.
- Replace the simulated `sendMessage` function with the real adapter while keeping the return format `{ ok, messageId }` or `{ ok: false, error }`.

## Operational Notice

Use only consent-based contact lists, respect opt-out requests, volume limits, sending windows, and provider policies. DISPARO WINC is structured for organized and auditable operations, not for bypassing platform rules.
