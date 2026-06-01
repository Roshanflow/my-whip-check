# React Project Conventions

This document is the source of truth for how we build React projects. It is written so Claude can search for answers quickly — each section heading maps to a question a developer or AI might ask.

---

## How to run the project

```bash
npm run dev       # Start dev server with hot reload
npm run build     # Production build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm run test      # Run Vitest
```

---

## How to structure the project

```
src/
  assets/          # Static assets (images, icons, fonts)
  components/      # Shared, generic UI components (used across features)
  contexts/        # React Context providers
  features/        # Domain-specific components, grouped by feature
  layouts/         # App shell — AppLayout, Sidebar, TopBar
  lib/             # Third-party client setup (e.g. Supabase, API clients)
  pages/           # Thin route-level wrappers that compose feature components
  router/          # AppRouter.jsx — all route definitions
  tests/           # Vitest test files (mirrors src/ structure)
```

**Rule:** Pages are thin. They import from `features/` and compose. Business logic and UI live in `features/`.

**Rule:** `components/` is for truly generic, reusable pieces (a Button, a Modal shell, an ErrorBoundary). Feature-specific components live in `features/<domain>/`.

---

## How to name files and folders

| What | Convention | Example |
|---|---|---|
| Component files | PascalCase | `ProjectForm.jsx`, `DashboardPage.jsx` |
| Utility / hook files | camelCase | `platformClient.js`, `useElapsed.js` |
| Feature folders | kebab-case | `features/change-control/`, `features/projects/` |
| CSS files | kebab-case, co-located with feature | `projects.css`, `doc-editor.css` |
| Test files | match source file + `.test` | `ProjectForm.test.jsx` |

**File extensions:** `.jsx` for components, `.js` for utilities and config. No TypeScript.

---

## How to write a component

All components are **functional**. No class components except `ErrorBoundary`.

```jsx
// PascalCase filename and function name
// Default export
// Props destructured inline

export default function ProjectForm({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name ?? '',
    status: project?.status ?? 'active',
  })

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // ...
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  )
}
```

**Rules:**
- One component per file
- Default export only (no named component exports)
- Helper functions inside the component are plain `function` declarations, not arrow functions assigned to `const`
- Event handlers named `handle<Event>` (e.g. `handleSubmit`, `handleDelete`)
- Setters for individual form fields named `set` with a key argument (see pattern above)

---

## How to structure a page

Pages are thin wrappers. They own routing context (URL params) and pass them down.

```jsx
import ProjectList from '../features/projects/ProjectList'
import ProjectDetail from '../features/projects/ProjectDetail'

export default function ProjectsPage() {
  return <ProjectList />
}
```

If a page needs data from the URL, it reads params and passes them as props — it does not contain business logic itself.

---

## How to style components

**Primary pattern: Tailwind CSS.** CSS variables define brand tokens; Tailwind consumes them.

Define brand tokens as CSS variables in `src/index.css`:

```css
:root {
  --bg: #F4F8FF;
  --surface: #FFFFFF;
  --text: #0F1D3B;
  --accent: #0B3A86;
  --border: #D1DCF0;
  --font-heading: 'Bricolage Grotesque', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

Use Tailwind for all styling, referencing tokens via arbitrary values:

```jsx
<div className="rounded-lg p-6 bg-[var(--surface)] border border-[var(--border)]">
  <h2 className="text-lg font-semibold text-[var(--text)]">
    Title
  </h2>
</div>
```

For conditional classes, use `clsx`. It keeps each condition on its own line and avoids messy string concatenation.

```jsx
import clsx from 'clsx'

<button className={clsx(
  'px-4 py-2 rounded transition-colors',
  isActive
    ? 'bg-[var(--accent)] text-white'
    : 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]',
  isDisabled && 'opacity-50 cursor-not-allowed',
)}>
  {label}
</button>
```

**Rules:**
- Tailwind classes for all layout, spacing, typography, colour, and interactive states (hover, focus, disabled)
- CSS variables for brand tokens only — never hardcode hex values directly in Tailwind classes
- No inline styles except for genuinely dynamic computed values (e.g. `style={{ width: `${progress}%` }}`)
- Do not mix Tailwind classes and inline styles on the same element

### When to use a CSS file

A feature CSS file is appropriate for three cases:

1. **Keyframe animations** — `@keyframes` cannot be expressed in Tailwind without arbitrary values becoming unreadable
2. **Third-party library styling** — rich text editors (ProseMirror, Tiptap) render their own DOM; Tailwind classes cannot reach inside them
3. **Complex selectors** — deeply nested rules, `::before`/`::after` with content, or attribute selectors that would require many chained Tailwind arbitrary values

Everything else — layout, spacing, colour, hover states, transitions — belongs in Tailwind. Do not create a CSS file just to avoid writing Tailwind classes.

---

## How to manage state

**Component state** — use `useState` for state that belongs to one component.

**Shared state** — use React Context. One context per domain concern.

```jsx
// src/contexts/AuthContext.jsx

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    // initialise auth state here
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

**Rules:**
- Export both the Provider and a named `use<Name>` hook from the same file
- Wrap providers in `main.jsx`, outermost first
- `undefined` means loading, `null` means absent — never use `null` for loading state

---

## How to fetch data

**Stack:** Supabase (transport) + TanStack Query (cache). They compose — TanStack's `queryFn` calls Supabase. Each tool has a distinct responsibility and they do not overlap.

### How the cache works

TanStack Query maintains an in-memory cache keyed by `queryKey`. **Same key = shared cache entry, one Supabase request across the whole app.** Different key = separate cache entry, separate request. This means if CRM and Billing both call `useQuery(clientsQuery)` — using the same key `['clients']` — the second call returns the cached data instantly with no network request. If they each defined their own query with a different key, they'd each hit Supabase independently.

When a write succeeds, `queryClient.invalidateQueries({ queryKey: ['clients'] })` marks all cache entries whose key starts with `['clients']` as stale. Any component currently mounted that uses that data automatically refetches in the background — no manual coordination needed.

| Concern | Tool |
|---|---|
| Read data shared across multiple modules | TanStack Query — `queryFn` calls Supabase |
| Read data local to one component | Supabase directly — simple, bounded fetches only (a single record by ID, a small filtered list). For queries that aggregate across tables or date ranges, push the computation into the database with a targeted aggregate query or an RPC function — do not fetch raw rows to count or sum them client-side. |
| Write data (insert / update / delete) | Supabase directly, then invalidate TanStack cache |
| Real-time subscriptions | Supabase Realtime — on change, invalidate TanStack cache |
| Auth | Supabase Auth via `AuthContext` |

### Shared query definitions

Queries for data used across more than one module live in `src/lib/queries.js`. This ensures the same `queryKey` and `queryFn` is used everywhere — preventing duplicate cache entries for the same data.

```js
// src/lib/queries.js
import { platform } from '@/lib/platformClient'

// Static query — spread directly into useQuery
export const clientsQuery = {
  queryKey: ['clients'],
  queryFn: async () => {
    const { data, error } = await platform.from('clients').select('*').order('name')
    if (error) throw error
    return data
  },
}

// Parameterised query — function returning the query object
export function engagementQuery(id) {
  return {
    queryKey: ['engagements', id],
    queryFn: async () => {
      const { data, error } = await platform.from('engagements').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  }
}
```

Usage:

```jsx
import { useQuery } from '@tanstack/react-query'
import { clientsQuery } from '@/lib/queries'

function ClientPicker() {
  const { data: clients, isLoading } = useQuery(clientsQuery)

  if (isLoading) return <p>Loading...</p>
  return clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
}
```

### Writing data

Use `useMutation` for all writes. It gives you `isPending` for free — use it to disable the submit button and prevent double-submits. Without it you need a manual `saving` state on every form.

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { platform } from '@/lib/platformClient'

function ClientForm({ onSaved }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '' })
  const [error, setError] = useState(null)

  const save = useMutation({
    mutationFn: async (values) => {
      const { error } = await platform.from('clients').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      onSaved()
    },
    onError: (err) => setError(err.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    save.mutate(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* fields */}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
```

**Rules:**
- `mutationFn` calls Supabase and throws on error — keep it focused on the write only
- `onSuccess` invalidates the relevant cache key then calls `onSaved()`
- `onError` puts the message into local error state for display
- Always disable the submit button with `isPending` — prevents double-submits
- For update vs insert, pass the existing record's `id` as part of `values` and branch inside `mutationFn`

### Query key conventions

- List: `['resource']` — e.g. `['clients']`
- Single item: `['resource', id]` — e.g. `['engagements', engagementId]`
- Filtered list: `['resource', { filter }]` — e.g. `['engagements', { clientId }]`

### TanStack Query setup

`QueryClientProvider` wraps the app in `main.jsx`:

```jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

Place `QueryClientProvider` as the outermost provider in `main.jsx`. It must wrap any context provider (e.g. `AuthProvider`) that itself calls `useQuery` or `useMutation` — inner providers can't access the query client if they're outside it.

### Real-time subscriptions

When a view needs to stay live as data changes, subscribe to Supabase Realtime and invalidate the relevant cache entry on each event. TanStack refetches automatically — no manual state update needed.

```jsx
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { platform } from '@/lib/platformClient'

export default function TicketList() {
  const queryClient = useQueryClient()

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: async () => {
      const { data, error } = await platform
        .from('support_tickets')
        .select('id, subject, status, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    const channel = platform
      .channel('support_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['support_tickets'] })
      })
      .subscribe()

    return () => { platform.removeChannel(channel) }
  }, [queryClient])

  if (isLoading) return <p className="text-sm opacity-50">Loading…</p>
  return tickets.map(t => <div key={t.id}>{t.subject}</div>)
}
```

**Rules:**
- Name channels `<table>_changes` — one channel per table per component
- Always clean up with `platform.removeChannel(channel)` in the `useEffect` return
- The subscription handler only invalidates the cache — never update React state directly from realtime events
- Only subscribe where live updates are genuinely needed; each subscription holds open a WebSocket connection

---

## How to write Supabase queries

### The `{ data, error }` contract

Every Supabase call returns `{ data, error }`. Always check `error` before using `data` — never assume the call succeeded.

In a `queryFn`, throw the error so TanStack can handle it:

```js
const { data, error } = await platform.from('projects').select('id, name').order('name')
if (error) throw error
return data
```

In a `mutationFn`, throw so `onError` receives it:

```js
const { error } = await platform.from('projects').insert(form)
if (error) throw error
```

Never use `.then()` chains on Supabase calls — always `await` and check `error` on the next line.

### Selecting columns

Never use `select('*')`. Name the columns you need — this keeps the data shape explicit and reduces payload size.

```js
// Bad
platform.from('projects').select('*')

// Good
platform.from('projects').select('id, name, status, client_id')
```

For joined data, use Supabase's nested select syntax:

```js
platform.from('engagements').select('id, title, client:clients(id, name)')
```

### Chaining filters and modifiers

```js
platform
  .from('time_entries')
  .select('id, started_at, duration, project:projects(name)')
  .eq('user_id', userId)
  .gte('started_at', startDate)
  .order('started_at', { ascending: false })
  .limit(50)
```

Common methods:

| Method | Purpose |
|---|---|
| `.eq(col, val)` | Exact match |
| `.neq(col, val)` | Not equal |
| `.gte(col, val)` / `.lte(col, val)` | Range comparison |
| `.in(col, [vals])` | Match any value in array |
| `.is(col, null)` | IS NULL check |
| `.order(col, { ascending })` | Sort results |
| `.limit(n)` | Cap row count |
| `.single()` | Expect exactly one row — errors if zero or many |
| `.maybeSingle()` | Expect zero or one row — returns `null` if not found, errors if many |

Use `.single()` when the row must exist (fetching by primary key). Use `.maybeSingle()` when absence is a valid state.

### Multi-step mutations

When a write involves multiple Supabase calls, later steps must clean up after themselves if they fail — there is no client-side transaction.

```js
const { data: invoice, error: invoiceErr } = await platform
  .from('invoices')
  .insert(invoiceData)
  .select('id')
  .single()
if (invoiceErr) throw invoiceErr

const { error: linesErr } = await platform
  .from('invoice_line_items')
  .insert(lines.map(l => ({ ...l, invoice_id: invoice.id })))

if (linesErr) {
  await platform.from('invoices').delete().eq('id', invoice.id)
  throw linesErr
}
```

**Rule:** If step N fails, undo everything written in steps 1 to N-1 before throwing.

**Prefer an RPC function for atomic multi-step writes.** A Postgres function runs inside a single transaction — if any step fails the whole operation rolls back automatically with no client-side cleanup. Reserve the manual rollback pattern for cases where no DB function is viable (e.g. a write that also calls an external API).

### Row-Level Security (RLS)

RLS is enforced server-side. Do not replicate it in client code — filtering by `user_id` when RLS already scopes to the current user is redundant.

```js
// Bad — redundant if RLS already restricts to the current user
platform.from('time_entries').select('id, duration').eq('user_id', session.user.id)

// Good — trust RLS
platform.from('time_entries').select('id, duration')
```

Only filter by user explicitly when querying as a specific user other than the authenticated one (e.g. an admin view), or when the table has no RLS policy.

---

## How to handle loading and error states

### In query components

`useQuery` returns `isLoading` and `isError`. Always handle both before rendering data — check loading first, then error, then render.

```jsx
import { useQuery } from '@tanstack/react-query'
import { clientsQuery } from '@/lib/queries'

export default function ClientList() {
  const { data: clients, isLoading, isError } = useQuery(clientsQuery)

  if (isLoading) return <p className="text-sm text-[var(--text)] opacity-50">Loading…</p>
  if (isError) return <p className="text-sm text-red-500">Could not load clients.</p>

  return (
    <ul>
      {clients.map(c => <li key={c.id}>{c.name}</li>)}
    </ul>
  )
}
```

**Rules:**
- `isLoading` check always comes before `isError`
- Both checks go at the top of the return block, before any other logic
- Loading message: muted text, no spinner required
- Error message: `text-red-500`, generic wording — do not expose raw Supabase error messages to the user
- Both use `text-sm` to stay visually subordinate to the content they replace

### In mutation forms

Mutation errors are surfaced via `onError` in `useMutation` into a local `error` string. Render it directly beneath the form fields, above the action buttons.

```jsx
{error && <p className="text-sm text-red-500">{error}</p>}
<button type="submit" disabled={save.isPending}>
  {save.isPending ? 'Saving…' : 'Save'}
</button>
```

The submit button label changes to reflect pending state — no separate spinner needed.

### What the ErrorBoundary handles

`AppLayout` wraps every route in an `ErrorBoundary`. If a `queryFn` throws and TanStack re-throws after retries, the ErrorBoundary catches it and renders a fallback. This is the last line of defence — do not rely on it for expected errors like "record not found". Handle those explicitly with `isError`.

---

## How to build a form

Plain React state — no form library.

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { platform } from '@/lib/platformClient'

export default function ProjectForm({ onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', status: 'active', budget: '' })
  const [error, setError] = useState(null)

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const save = useMutation({
    mutationFn: async (values) => {
      const { error } = await platform.from('projects').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onSaved()
    },
    onError: (err) => setError(err.message),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) return setError('Name is required')
    save.mutate(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={form.name} onChange={e => set('name', e.target.value)} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  )
}
```

**Rules:**
- Form state is a single object, not individual `useState` per field
- Update via `setForm(f => ({ ...f, [key]: val }))` — never mutate directly
- Error state is a single string (most forms only need one error message at a time)
- Submit via `save.mutate(form)` — never call Supabase directly inside `handleSubmit`
- Disable the submit button with `save.isPending` — prevents double-submits
- Numeric fields: convert with `Number(v)` or use a helper `const numOrNull = v => v === '' ? null : Number(v)`

---

## How to write a custom hook

Custom hooks live in `src/features/<domain>/` alongside the components that use them, or in `src/lib/` if used across multiple features.

```jsx
// src/features/time/useElapsed.js

import { useState, useEffect } from 'react'

export default function useElapsed(startedAt) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - new Date(startedAt)) / 1000)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setElapsed(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}
```

**Rules:**
- Named `use<Thing>` — always camelCase starting with `use`
- Return the value directly (not an object) when there's only one thing to return
- Clean up side effects in the `useEffect` return function

---

## How to add a route

All routes live in `src/router/AppRouter.jsx`. Add a new `<Route>` and import the page.

```jsx
import { Routes, Route } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import DashboardPage from '../pages/DashboardPage'
import ProjectsPage from '../pages/ProjectsPage'

export default function AppRouter() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </AppLayout>
  )
}
```

---

## How to use the path alias

`@` resolves to `src/`. Use it for imports that would otherwise require `../../..` traversal.

```js
import { useAuth } from '@/contexts/AuthContext'
import { platform } from '@/lib/platformClient'
```

---

## How to write tests

**Stack:** Vitest + React Testing Library. Run with `npm run test`.

<details>
<summary>First-time setup</summary>

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add to `vite.config.js`:
```js
test: { environment: 'jsdom', globals: true, setupFiles: './src/tests/setup.js' }
```

Create `src/tests/setup.js`:
```js
import '@testing-library/jest-dom'
```

Add to `package.json` scripts: `"test": "vitest", "test:ui": "vitest --ui"`
</details>

### What Vitest is responsible for

- **Component behaviour** — does the component render the right output, respond to user interaction, and call the right callbacks?
- **Utility functions** — pure functions in `src/lib/` (formatters, helpers)
- **Form validation** — does submitting an empty form show the right error?

Vitest is **not** responsible for visual appearance, layout, or end-to-end flows. Don't test implementation details — test what the user sees and does.

### File structure

Test files live in `src/tests/` and mirror `src/`. Use `.test.jsx` for components, `.test.js` for utilities.

```
src/tests/
  features/
    projects/
      ProjectForm.test.jsx
  lib/
    formatters.test.js
  setup.js
```

### Component test

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ProjectForm from '@/features/projects/ProjectForm'

describe('ProjectForm', () => {
  it('calls onSaved after successful submit', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<ProjectForm onSaved={onSaved} onClose={() => {}} />)

    await user.type(screen.getByLabelText(/name/i), 'New Project')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onSaved).toHaveBeenCalled()
  })

  it('shows an error when name is empty', async () => {
    const user = userEvent.setup()
    render(<ProjectForm onSaved={vi.fn()} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })
})
```

### Utility test

```js
import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/lib/formatters'

describe('formatCurrency', () => {
  it('formats a number as GBP', () => {
    expect(formatCurrency(1234.5)).toBe('£1,234.50')
  })
})
```

### Mocking Supabase

```js
vi.mock('@/lib/platformClient', () => ({
  platform: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}))
```

**Rules:**
- Use `userEvent` over `fireEvent` — it simulates real interactions including focus and keyboard events
- Prefer `getByRole` and `getByLabelText` over `getByTestId`
- One `describe` block per component or function; one `it` per behaviour

---

## How to set up environment variables

Required variables go in `.env.local` (never committed). Document them in `.env.example`.

```bash
# .env.example
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Access in code via `import.meta.env.VITE_*`. All client-side vars must be prefixed `VITE_`.

---

## How to connect to Supabase

Supabase is added after a project is approved — not in the initial scaffold.

When adding it:

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

Always import from `@/lib/platformClient` — never create a second Supabase client.

---

## How to write Supabase edge functions

Edge functions live in `supabase/functions/<name>/index.ts` and are deployed to Supabase's Deno runtime.

**File extension: `.ts`** — Deno handles TypeScript natively with no compilation or build step. This is intentionally different from the frontend "No TypeScript" rule, which applies only to the Vite/React code. The two runtimes have separate conventions.

**Rules:**
- Always handle CORS preflight: `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })`
- Use a `callerClient` (built from the request's `Authorization` header) to verify the caller is authenticated before performing any privileged action
- Use the service role (`SUPABASE_SERVICE_ROLE_KEY`) only for operations that require it: admin auth, cross-user data access
- Register every new function in `supabase/config.toml`:
  - `verify_jwt = true` (default) for functions called by authenticated app users
  - `verify_jwt = false` for webhooks, auth hooks, and other callers that supply their own JWT — verify it manually inside the function

---

## ESLint rules

Key rules enforced in `eslint.config.js`:

- `no-unused-vars` — error; vars named `_X` or `ALL_CAPS` are exempted
- `react-hooks/rules-of-hooks` — error
- `react-refresh/only-export-components` — warning (for HMR)

Run `npm run lint` before committing. Fix all errors; warnings are advisory.
