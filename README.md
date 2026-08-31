# Bilby

Travel eSIM for Australian outbound travellers. Bilby is the telecommunications
division of Nextwave.au.

## What is in here

| Path | What it is |
|---|---|
| `web/` | Next.js. Serves the landing page, the web app, the mobile API and the staff console, routed by hostname. |
| `app/` | Flutter. Android now, iOS later, against the same API. |
| `brand/` | Marks, icons, destination art and the generators that produce them. |
| `preview/` | Design artefacts. Not shipped. |
| `ARCHITECTURE.md` | Host map, API surface, staff roles, supplier registry. **Read this first.** |
| `DECISIONS.md` | Everything settled, and why. Check before assuming. |

## Running it

```bash
cd web
npm install
npm run dev
```

With no environment set it uses a local SQLite file and a mock supplier, on
purpose: a fresh clone must run without an account anywhere. Copy `.env.example`
to `web/.env.local` when you want real services.

## The rule that matters most

**No hostname is written as a literal outside `web/src/lib/hosts.ts`.** Every
customer host derives from one constant there, and the Flutter side mirrors it
in `app/lib/brand.dart`. If a string elsewhere in this repo contains a domain,
it is a bug waiting for the day one of them moves.
