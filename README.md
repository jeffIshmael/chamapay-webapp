# Chamapay Web App

Next.js client for Chamapay (ported from `chamapay-minipay`).

## Auth

Sign-in is **Google** or **email OTP** only — no wallet connect. After auth, the server CDP smart wallet (`smartAddress`) is used for balances and on-chain actions via API.

## Setup

```bash
cd web
npm install
```

Copy env:

```bash
# web/.env
NEXT_PUBLIC_SERVER_URL=https://chamapay-app.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as Application EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID>
```

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Link from landing

Point the landing site “Open app” CTA to this deployment URL (e.g. `https://app.chamapay…`).
