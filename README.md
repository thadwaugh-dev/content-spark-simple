# ContentSpark

**Spark viral content in seconds.**

A beautiful, production-ready web app that instantly generates:
- 10 catchy social media captions
- 5 X/Twitter thread ideas
- Relevant hashtags
- A short video script hook

Tailored to any niche you throw at it.

## Features
- **Instant client-side generation** — no API keys, works offline
- **Simple auth** — email/password or one-click demo mode (persisted)
- **Freemium model** — 5 generations/day free, $9/mo Pro for unlimited + full history
- **Save favorites** + full generation history
- **Export beautiful PDFs** (branded, ready to use or share)
- **Copy everything** with one click
- **Clean modern design** (Tailwind + QuickWin-inspired aesthetics: emerald accents, rounded cards, delightful interactions)
- Fully responsive and mobile-friendly
- 100% client-side (localStorage) for maximum simplicity

## Quick Start (Local Development)

Since this project was assembled in an environment without Node, run these commands on your machine:

```bash
cd ContentSpark
npm install
npm run dev
```

Open http://localhost:3000

## Production Build

```bash
npm run build
npm run start
```

## Full Folder Structure

```
ContentSpark/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # The entire app (landing + generator + modals)
│   └── globals.css         # Tailwind + custom QuickWin-style design system
├── components/             # (Add more here as you scale)
├── lib/
│   ├── generator.ts        # High-quality templated content engine
│   ├── storage.ts          # All localStorage logic + daily usage
│   └── types.ts            # TypeScript interfaces
├── package.json
├── next.config.mjs
├── tsconfig.json
└── README.md               # You are here
```

## How the Generator Works

Pure client-side with sophisticated templating:
- 15+ high-quality caption templates
- Smart thread structures
- Keyword-aware hashtag suggestions
- Deterministic + randomized variety (same topic produces nice variations)
- Easy to replace with real AI later (Grok API, etc.)

## Freemium & Limits

- Free: 5 generations per calendar day (resets at midnight local time)
- Pro: Unlimited + access to full (non-favorited) history
- Upgrade is mocked in the UI for demo purposes (instant toggle)

## PDF Export

Uses jsPDF. Produces a clean, professional multi-section PDF with your branding.

## Deploy to Vercel (Recommended)

1. Make sure you're in the `ContentSpark` folder
2. `git init`
3. `git add .`
4. `git commit -m "Initial ContentSpark"`
5. Push to GitHub
6. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
7. Vercel auto-detects Next.js. Deploy.

No environment variables needed for the current version.

Future production enhancements (real auth, payments, real AI) will require env vars.

## Upgrading to Real Backend (Recommended Path)

**Supabase (auth + database):**
- `npm install @supabase/supabase-js`
- Create tables for users/generations
- Replace `lib/storage.ts` with Supabase calls
- Use Supabase Auth instead of mock

**Real AI (Grok / xAI or OpenAI):**
- Move generation to a Server Action or Route Handler
- Add your API key as env var
- Keep the current generator as instant fallback

## Credits & Inspiration

Built with ❤️ using patterns from the QuickWin demo (same emerald palette, card styles, modern polish).

This entire project was planned in Grok Plan Mode and implemented as a complete, delightful demo.

---

Enjoy building with ContentSpark! Feedback and feature ideas welcome.

## Pro AI generate path

The GitHub Pages site stays static. Pro calls a Vercel serverless function so the model API key never ships to the browser.

Free users still use the built-in template generator. Pro calls are rejected without a valid Lemon Squeezy license, and the page falls back to that same local generator. The browser also stops at 30 Pro generations per day. The API adds a shorter in-memory limit (8 per minute and 30 per hour, per key and per IP, on each warm serverless instance).

### Environment variables (Vercel only)

| Name | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | Preferred | xAI chat key. Function tries `grok-4.6`, then `grok-4.3`, then `grok-4.5`. |
| `GROQ_API_KEY` | Fallback | Used only when `XAI_API_KEY` is missing. Function uses `llama-3.1-8b-instant`. |
| `LEMONSQUEEZY_PRODUCT_ID` | No | Product id the license must belong to. Default `1325795`. Comma-separate ids if test and live products differ. |
| `LEMONSQUEEZY_STORE_ID` | No | When set, `meta.store_id` must match. Leave unset to skip the store check. |

No Lemon Squeezy API key is used. The public License API accepts test-mode keys and live keys on the same URLs. Variant id is not checked, so test variant `2072002` and a later live variant both work.

If both model keys are missing, a valid license still gets `503` from `POST /api/generate` and the client uses templates. A missing or rejected license never calls the model.

Do not commit keys. Set them in the Vercel project: Settings → Environment Variables.

### Deploy the function (Vercel)

1. Import `thadwaugh-dev/content-spark-simple` at [vercel.com/new](https://vercel.com/new).
2. `vercel.json` disables the Next.js build so this project only serves `api/generate.js`.
3. Add `XAI_API_KEY` (or `GROQ_API_KEY`) for Production.
4. Deploy. The endpoint is:

`https://content-spark-simple.vercel.app/api/generate`

If Vercel assigns a different host, update `PRO_GENERATE_URL` in `index.html` to that host plus `/api/generate`.

Body: `{ "topic": string, "license_key": string, "instance_id": string | null }`

`POST /api/license` with `{ "license_key", "instance_id" }` checks a key without calling the model. `action: "deactivate"` releases that browser's activation.

### Lemon Squeezy confirmation button

In the ContentSpark Pro product, set the confirmation modal button link (and the receipt button, if it has its own link) to:

`https://thadwaugh-dev.github.io/content-spark-simple/?license_key=[license_key]`

Lemon Squeezy replaces `[license_key]` on the confirmation modal button and the receipt button. Do not use `?pro=1`. Customers who never click the button can paste the key from the receipt email into **Enter license key**.

The page stores the key and the Lemon Squeezy instance id only after `/api/license` accepts them. `?pro=1` does not unlock Pro.
