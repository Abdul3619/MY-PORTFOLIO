# Abdul Wahab — Portfolio

Personal portfolio and CMS for Abdul Wahab, web developer and solar technician. Public pages cover projects, skills, certificates, testimonials, a resume and an interactive solar sizing calculator. A private admin dashboard manages all of that content.

## Stack

- **Frontend:** React 19, React Router 7, TanStack Query, Tailwind CSS 4, Motion, GSAP, i18next (EN / FR / AR)
- **Server:** Express (API + server-side rendering), Zod validation
- **Data:** Supabase (Postgres, Auth, Storage)
- **Hosting:** Vercel (static assets on the CDN, pages and API in one serverless function), or any Node host via `npm start`

## How rendering works

Public pages are **server-side rendered**. For each request, `server.ts` loads the page's content from Supabase, renders the React app with `src/entry-server.tsx`, and returns complete HTML (content, `<title>`, meta description, Open Graph tags). The prefetched data is embedded in the page, so the client (`src/main.tsx`) hydrates without refetching. If Supabase is slow or unreachable, the page still renders with its built-in fallback content and the client fetches the rest once it loads.

The admin area (`/admin/*`) renders on the client only.

## Getting started

```bash
cp .env.example .env   # fill in the Supabase credentials
npm install
npm run dev            # http://localhost:3000
```

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client + server | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Public anon key (auth, realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Server-side database access |
| `GEMINI_API_KEY` | server only | Optional: translates CMS content for FR / AR visitors |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite dev server with SSR |
| `npm run build` | Client bundle (`dist/client`), SSR bundle (`dist/server`), compiled server (`dist/server.cjs`) |
| `npm start` | Runs the production build |
| `npm run lint` | Type-checks the project |

Database migrations live in `supabase/migrations`.
