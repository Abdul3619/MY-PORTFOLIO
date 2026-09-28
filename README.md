# Abdul Wahab — Portfolio

This is my personal portfolio and the CMS behind it. I am a web developer and solar technician, and the site shows my projects, skills, certificates, client testimonials, my resume and an interactive solar sizing calculator. I manage all of that content from a private admin dashboard.

## Stack

- **Frontend:** React 19, React Router 7, TanStack Query, Tailwind CSS 4, Motion, GSAP, i18next (EN / FR / AR)
- **Server:** Express (API + server-side rendering), Zod validation
- **Data:** Supabase (Postgres, Auth, Storage)
- **Hosting:** Vercel (static assets on the CDN, pages and API in one serverless function), or any Node host via `npm start`

## How rendering works

I render the public pages on the server. For each request, `server.ts` loads the page's content from Supabase, renders the React app with `src/entry-server.tsx`, and returns complete HTML (content, `<title>`, meta description, Open Graph tags). The prefetched data is embedded in the page, so the client (`src/main.tsx`) hydrates without refetching. If Supabase is slow or unreachable, the page still renders with its built-in fallback content and the client fetches the rest once it loads.

The admin area (`/admin/*`) only renders in the browser.

## Running it locally

You need Node.js and a Supabase project.

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

The database migrations are in `supabase/migrations`.
