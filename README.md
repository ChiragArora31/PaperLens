# PaperLens

PaperLens turns dense arXiv papers into a structured learning experience.  
Instead of reading 20+ pages linearly, users get guided explanations, visual diagrams, concept cards, and an actionable learning path in one flow.

## What users get

- Layered explanations (`Simple`, `Engineer`, `Deep Technical`)
- TL;DR plus a full summary suite (`ultra-short`, `1-minute`, `5-minute`, detailed)
- Concept cards with intuition, technical definitions, pitfalls, and mini quizzes
- Visual section with guaranteed output:
- `2` Mermaid flowcharts
- `2` custom infographic-style diagrams
- Section-by-section paper breakdown
- Learning path with step goals and estimated time
- Why-it-matters panel with use-cases and adoption context
- Light and dark themes with responsive UI across desktop and mobile

## Input model

- Accepted input: arXiv URL or arXiv paper ID
- No PDF uploads from users
- Gemini API key is server-managed (`GEMINI_API_KEY`)

## Tech stack

- Next.js 16 (App Router, TypeScript)
- React 19
- Gemini (`@google/generative-ai`)
- Mermaid
- Framer Motion
- Lucide Icons

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Add your Gemini key to `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

4. Run the app:

```bash
npm run dev -- --port 3000 --webpack
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

Or all at once:

```bash
npm run check
```

## Production hardening already included

- Strict input validation for `/api/analyze`
- Graceful handling of malformed upstream/model JSON
- Fallback content path when PDF extraction fails
- `no-store` upstream fetch behavior for fresh paper data
- Security response headers (`X-Frame-Options`, `Referrer-Policy`, etc.)
- `nodejs` runtime enforced for analysis route
- Production-safe theme persistence and hydration

## Project structure

```text
src/
  app/
    api/analyze/route.ts      # analysis endpoint
    page.tsx                  # landing + orchestration
  components/
    HeroInput.tsx
    ThemeToggle.tsx
    dashboard/                # all learning sections
  lib/
    arxiv.ts                  # id parsing + metadata + text extraction
    gemini.ts                 # prompting + normalization + fallbacks
    types.ts
```

## Deploy notes

- Recommended Node.js: `>=20.11.0`
- Set `GEMINI_API_KEY` in your deployment environment
- Run `npm run build` in CI before release

---

If you are working on the product direction: prioritize reliability of parsing + clarity of learning output over adding new surface features. That is where user trust is won.
