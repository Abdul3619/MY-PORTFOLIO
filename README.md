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
| `ANTHROPIC_API_KEY` | server only | AI assistant: Claude API key |
| `CHAT_DATABASE_URL` | server only | AI assistant: Postgres URL for the restricted `chatbot_reader` login (Supabase transaction pooler) |
| `CHAT_VISITOR_SALT` | server only | AI assistant: random string (32+ characters) used to hash visitor IPs for rate limiting |
| `CHAT_MODEL`, `CHAT_EFFORT` | server only | Optional: Claude model (default `claude-opus-5-5`) and effort (default `low`) |
| `CHAT_ALLOWED_ORIGINS` | server only | Optional: extra comma-separated origins allowed to call `/api/chat` from a browser |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite dev server with SSR |
| `npm run build` | Client bundle (`dist/client`), SSR bundle (`dist/server`), compiled server (`dist/server.cjs`) |
| `npm start` | Runs the production build |
| `npm run lint` | Type-checks the project |

The database migrations are in `supabase/migrations`.

## AI assistant

The chat widget (`src/components/assistant`) posts to `/api/chat` (`chatbot/route.ts`). The server looks up
relevant entries in `public.public_knowledge_base`, sends them to Claude with the instructions in
`chatbot/systemPrompt.ts`, and streams the answer back. Without the three assistant variables above the endpoint
answers 503 and the widget shows a short message pointing to the contact form.

- **What it knows:** only published rows of `public_knowledge_base`. Edit or publish entries in Supabase; drafts
  (`is_published = false`) are invisible to it. Initial content is in `supabase/seed/public_knowledge_base.sql`.
- **What it can reach:** it connects as `chatbot_reader`, a login that can read published knowledge base rows and
  call one rate-limit function, and nothing else. It never uses the service-role key, and the model has no tools,
  so a visitor can't talk it into reading private tables.
- **Cost limits:** per visitor 8 messages a minute and 60 a day, 1000 a day site-wide (in
  `private.chat_take_quota`), plus a per-instance burst limit. Visitor IPs are hashed, never stored.
- **Setting the login's password:** generate a strong password and run
  `alter role chatbot_reader password '...';` in the Supabase SQL editor (or set a SCRAM verifier), then put it in
  `CHAT_DATABASE_URL` as
  `postgresql://chatbot_reader.<project-ref>:<password>@<pooler-host>:6543/postgres`.
