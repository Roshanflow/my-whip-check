# CLAUDE.md

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest
```

## Stack

- React 19 + Vite
- React Router v7 (client-side routing)
- TanStack Query (data fetching, caching)
- Tailwind CSS v4 (utilities) + CSS variables (theming)
- Vitest + React Testing Library (tests in src/tests/)

## Conventions

Full conventions: `docs/conventions.md` (copied into this project from the flowbird-claude-setup repo at scaffold time).

Key rules:
- All components are functional, default export, PascalCase filename
- Form state is a single object: `setForm(f => ({ ...f, [key]: val }))`
- Shared state via React Context — one context per domain concern
- Data fetching via TanStack Query — never raw fetch/useEffect for server data
- Styles: CSS variables for tokens, inline styles for dynamic values only
- Tests live in `src/tests/` mirroring `src/`

## Structure

```
src/
  pages/       ← thin route wrappers
  features/    ← domain components and logic
  components/  ← shared generic UI
  contexts/    ← React Context providers
  layouts/     ← AppLayout, Sidebar, TopBar
  router/      ← AppRouter.jsx
  lib/         ← third-party client setup
  tests/       ← Vitest tests
```

## Adding Supabase (post-POC approval)

```bash
npm install @supabase/supabase-js
```

Create `src/lib/platformClient.js`:

```js
import { createClient } from '@supabase/supabase-js'
export const platform = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Add to `.env.local`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
