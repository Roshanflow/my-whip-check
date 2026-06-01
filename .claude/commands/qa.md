---
description: Full QA pass on uncommitted and unpushed code — tests, cross-module effects, agentic completeness, correctness, and convention compliance
allowed-tools: Bash, Read, Glob, Grep
---

You are the QA reviewer for this project. Your job is to catch everything before code is pushed.

A **module** is a `src/features/<domain>/` directory. Cross-module effects are the hardest class of bug — give them the most attention.

Work through every step in order. Do not skip steps because earlier steps look clean. Collect all findings and surface them together at the end.

---

## Step 1 — Run the test suite

```bash
npm run test -- --run 2>&1
```

Record the full result: how many passed, how many failed, any errors. Do not abort — continue through all steps regardless of outcome.

---

## Step 2 — Get the diff

```bash
git diff HEAD                  # uncommitted (staged + unstaged)
git diff origin/main..HEAD     # committed but not yet pushed
```

Combine both. If `$ARGUMENTS` is non-empty, treat it as a path filter.

If the combined diff is empty and all tests passed, say **"Nothing to review — safe to push."** and stop.

Build a working list:
- **Touched files** — every file with any change
- **Touched modules** — unique `src/features/<domain>/` directories in that list
- **Shared surfaces touched** — flag any of these specifically, as they require the deepest analysis:
  - `src/lib/queries.js`
  - `src/contexts/*.jsx`
  - `src/components/**`
  - `src/router/AppRouter.jsx`
  - `src/layouts/Sidebar.*`
  - `src/lib/platformClient.js`

---

## Step 3 — Completeness check (agentic failure mode)

This is the most important step. AI systems make primary changes correctly but routinely miss updating the things that depend on them. Check each of the following explicitly.

### Module spec coverage
For every touched module (`src/features/<domain>/`), check whether a spec exists:

```bash
# For each <domain> in the touched modules list:
ls docs/spec/modules/<domain>.md 2>/dev/null || ls -d docs/spec/modules/<domain>/ 2>/dev/null
```

If no spec is found for a domain, flag it. This is not a blocker for pushing but it means Claude will have to ask the user for context every time it edits that module.

### New pages or components
For every new `.jsx` file added under `src/features/` or `src/pages/`:
- Is it imported and used somewhere? If it's a page, is it registered in `src/router/AppRouter.jsx`?
- If it's a new route, does the Sidebar in `src/layouts/` link to it?

```bash
grep -r "<new-component-name>" src/ --include="*.jsx" --include="*.js"
grep -r "<new-route-path>" src/router/ src/layouts/
```

### Renamed or changed props / exports
For every function, component, or hook whose signature changed (renamed prop, added required prop, changed return shape):
- Grep for every import or usage of that export across the whole `src/` tree
- Confirm each call site has been updated to match the new signature

```bash
grep -r "<old-name>\|<new-name>" src/ --include="*.jsx" --include="*.js"
```

### Changed hook return values
If a custom hook now returns a different shape:
- Find every consumer with `const { ... } = use<Hook>()`
- Confirm destructuring matches the new shape

### Changed context value shape
If any context's `value={}` prop changed:
- Find every `use<ContextName>()` call across all features
- Confirm each consumer handles the new shape

```bash
grep -r "useAuth" src/ --include="*.jsx" --include="*.js"
# Add other project-specific context hooks here
```

### New Supabase columns selected
If a query now selects additional columns:
- Are those columns actually present in the database? (Check existing migrations in `supabase/migrations/` for the table definition)
- If a column was added to `select()`, confirm it isn't breaking the existing type assumptions downstream

### Query key changes
If a `queryKey` in `queries.js` was renamed or removed:
- Grep every `useQuery`, `prefetchQuery`, and `invalidateQueries` call for the old key
- Confirm all references have been updated

```bash
grep -r "queryKey\|invalidateQueries" src/ --include="*.jsx" --include="*.js"
```

### Dev debris
Scan every changed file for things that should not be in production:

```bash
grep -n "console\.\|TODO\|FIXME\|HACK\|debugger\|hardcoded" <changed_files>
```

Also look for hardcoded UUIDs, hardcoded user IDs, or hardcoded environment-specific strings in changed files.

---

## Step 4 — Cross-module cache analysis

### Query invalidation blast radius
For every `invalidateQueries` call in any changed file:
- What `queryKey` is being invalidated?
- Which other modules call `useQuery` with that key (or a prefix of it)?
- Is the invalidation intentional for those modules, or is it an unintended side effect?

```bash
grep -rn "invalidateQueries" src/features/ --include="*.jsx" --include="*.js"
grep -rn "queryKey" src/features/ --include="*.jsx" --include="*.js"
```

### Duplicate query keys
If a new `useQuery` was added directly inside a feature (not via `queries.js`):
- Is the same data already fetched elsewhere under a different key?
- If yes: should this use the shared definition in `queries.js` instead?

### Inter-feature imports
For every changed file in `src/features/<domain-A>/`, check for imports from `src/features/<domain-B>/`:

```bash
grep -n "from.*\.\.\/[a-z]" <changed_files_in_features>
```

Any cross-feature import is both a convention violation and a coupling risk. Flag it.

### Shared component changes
If any file in `src/components/` changed:

```bash
grep -r "<ComponentName>" src/features/ --include="*.jsx" -l
```

List every feature that imports it — they are all potentially affected.

---

## Step 5 — Code correctness

For each changed file, check for these specific patterns:

### useEffect hygiene
- Does every `useEffect` that sets up a subscription, interval, or event listener have a cleanup `return () => ...`?
- Are dependency arrays complete? Look for variables used inside the effect that are not listed in deps.
- Could any effect cause an infinite loop (e.g. state being set unconditionally, state variable listed in deps)?

### State mutation
- Is `setForm` always called as `setForm(f => ({ ...f, ... }))` — never as direct mutation?
- Is any object or array from state mutated directly (`.push()`, direct property assignment) before being passed to a setter?

### Async correctness
- Are there any unhandled promise rejections (async functions called without `await` or `.catch()`)?
- Does every Supabase call check `error` before using `data`?
- In multi-step mutations, does every step after the first clean up previous steps on failure?

### Race conditions
- If a component can unmount while an async operation is in flight, is there a guard (`isMounted`, `AbortController`, or early return)?
- Can a form be submitted twice before `isPending` is set? (Only possible if the button is not `disabled={save.isPending}`)

### Null / undefined safety
- Are `undefined` (loading) and `null` (absent) states handled correctly? `null` should never be used as a loading sentinel.
- Is optional chaining (`?.`) used wherever a value could be absent before data loads?

---

## Step 6 — Supabase data layer

### Multi-step mutations
If any `mutationFn` contains more than one Supabase write:
- If step 2+ fails, are steps 1..N-1 rolled back?
- If an RPC function is available for this operation, is it being used instead?

### .single() vs .maybeSingle()
- Is `.single()` used anywhere the record might legitimately not exist? That throws on zero rows — use `.maybeSingle()` for optional lookups.

### Column exposure
- Does any new or changed query use `select('*')`? Name columns explicitly.

### Numeric coercion
- Are any form fields that map to numeric DB columns passed as strings? Check for `Number(v)` or `v === '' ? null : Number(v)` where needed.

### RLS over-filtering
- Is any query filtering by `user_id` where RLS already scopes to the current user? Flag as redundant.

---

## Step 7 — Convention compliance

For each changed `.jsx` or `.js` file, check:

- [ ] PascalCase for component files, camelCase for utilities and hooks
- [ ] Default export only — no named component exports
- [ ] Helper functions inside components are `function` declarations, not `const` arrow functions
- [ ] Event handlers named `handle<Event>`
- [ ] Form state is a single object — not individual `useState` calls per field
- [ ] Writes use `useMutation`, not direct Supabase calls inside event handlers
- [ ] Submit button disabled with `save.isPending`
- [ ] Loading rendered with `isLoading` check before `isError` check
- [ ] Error messages use `text-red-500 text-sm` — no raw Supabase error messages shown to the user
- [ ] No hardcoded hex colours — CSS variables via `var(--token)` only
- [ ] No inline styles except genuinely dynamic computed values
- [ ] No `.then()` chains on Supabase — always `await` + check `error`
- [ ] Test files mirror source path under `src/tests/`

---

## Step 8 — Test coverage gap

For every new conditional branch, validation rule, or error path added in the diff:
- Is there a test that covers it?
- If `onError` was wired up in a new mutation, is there a test that triggers it?
- If a new form field has a required validation, is there a test for submitting without it?

Do not require 100% coverage — only flag cases where a meaningful new behaviour has no test at all.

---

## Report

Present findings in this structure. Omit any section with no findings entirely — do not write "no issues found" per section.

---

### Test results

**N tests passed.** ← if clean, one line only

If failures:
> **[FAIL]** `ProjectForm > shows error when name is empty`
> `src/tests/features/projects/ProjectForm.test.jsx:31`
> _failure message_

---

### Completeness gaps

> **[NO SPEC]** Module `notifications` has no spec in `docs/spec/modules/`. Claude will ask for context on every edit — create `docs/spec/modules/notifications.md` to fix this.

> **[MISSING REGISTRATION]** `NewPage.jsx` created but not added to `AppRouter.jsx`

> **[STALE CALLER]** `onSaved` prop renamed to `onSuccess` in `ClientForm` but `ClientsPage.jsx:44` still passes `onSaved`

> **[KEY DRIFT]** `queryKey: ['engagements', id]` renamed in `queries.js` but `EngagementDetail.jsx:12` still references the old key

---

### Cross-module effects

> **[billing → crm]** Mutation in `InvoiceForm.jsx` invalidates `['clients']` — `ClientList.jsx` in CRM will refetch on every invoice save
> `src/features/billing/InvoiceForm.jsx:67`
> Risk: unintended refetch; confirm this is intentional or narrow the invalidation

---

### Code correctness

> **[MISSING CLEANUP]** `useEffect` in `TicketList.jsx` subscribes to a Supabase channel but has no `return () => platform.removeChannel(channel)`
> `src/features/support/TicketList.jsx:34`

---

### Data layer

> **[SINGLE_ON_OPTIONAL]** `.single()` used on a lookup that can return zero rows — will throw if record not found
> `src/features/projects/ProjectDetail.jsx:19`
> Fix: use `.maybeSingle()` and handle `null`

---

### Convention violations

> **[ARROW FUNCTION]** Helper defined as `const handleReset = () => ...` inside component — should be `function handleReset()`
> `src/features/time/TimerForm.jsx:28`

---

### Test coverage gaps

> **[UNTESTED BRANCH]** New `if (!form.budget)` validation in `ProjectForm.jsx:41` has no corresponding test

---

### Suggestions

Only include genuinely useful observations — not restatements of conventions.

---

If everything is clean: **"All N tests passed. No issues found — safe to push."**
