---
name: platform-spec
description: Build a platform-level specification document for an existing business-management platform. Establishes a shared vocabulary (intent ladder + data axis), catalogs every module by reading the router, sidebar, and database, and produces docs/spec/platform.md plus a folder layout for per-module docs. Invoke when the user says "spec this out", "build a platform spec", "I want a hierarchy for the whole app", or similar.
---

# Platform Spec

A reusable process for producing a platform-level specification document for a business-management web app. The output is a single `docs/spec/platform.md` plus a planned folder for per-module docs.

## When to use this skill

Use it when **all** of these are true:
- The project is a multi-module web platform (CRM, dashboards, billing, support, etc. — not a library, CLI, or single-purpose tool).
- There is an existing codebase to discover from: a router, a navigation config, and a database/data layer.
- The user wants a navigable spec hierarchy, not a one-page technical-architecture diagram.

If those don't hold, tell the user the skill isn't the right fit and offer an alternative (architecture diagram, README, ADR).

## What this produces

```
docs/spec/
  platform.md          ← produced by this skill
  modules/             ← folder layout planned, individual docs are follow-on work
```

`platform.md` contains: vocabulary, the complete module table(s), navigation placement, open questions, and the planned folder structure.

---

## The vocabulary (fixed)

This skill uses one vocabulary, deliberately. If the user pushes for a different shape, flag the mismatch (see "Fit check" below) and let them decide whether to adapt or abandon the skill — do not silently bend the vocabulary.

```
Platform
  └─ [Module Group]                  optional — only for cohesive clusters
       └─ Module ──────── owns ──▶ Data-objects   (the "nouns" axis)
            └─ View
                 └─ Component                     (the "intent" axis)
```

- **Platform** — the product as a whole: every module plus the shell that hosts them (auth, navigation, layout).
- **Module Group** — *optional* grouping tier above Module. Bundles modules that together serve one cohesive super-capability. Owns no data, has no views of its own. Use only where a cluster is genuinely cohesive — most modules sit directly under the Platform.
- **Module** — a self-contained part of the product, organised around a single business capability. Made up of the views and components that deliver it, plus any data-objects it owns.
- **View** — a single screen within a module; the navigable unit (typically one route).
- **Component** — a self-contained building block with a single purpose. Visual element *or* functional behaviour.
- **Data-object** — a record type a module owns and is the source of truth for. A module may reference data-objects owned by other modules.

**Module kinds** (a property of every module, not a new tier):
- **data-owning** — owns ≥1 data-object.
- **aggregating** — owns 0 data-objects; exists to present data owned by other modules.

Rule is strict: ownership decides kind. A data-owning module may aggregate heavily — the kind only records *whether it owns any data*.

**Navigation placement** (sidebar, sub-nav, direct URL, standalone) is an *attribute* of a module, never part of its definition. A module exists whether or not it has a nav entry.

---

## Process

### Step 1 — Fit check

Before anything else, confirm the codebase has the shape this skill expects:

1. Identify the **router** (typically `src/router/`, `src/App.{jsx,tsx}`, `src/routes/`, `app/` for Next.js).
2. Identify the **navigation config** (sidebar, top nav, drawer).
3. Identify the **data layer** (Supabase client, Prisma schema, ORM models, REST/GraphQL backend module list).

If any of these is missing or trivial (e.g., a five-route SPA with no DB), stop and tell the user: "This project doesn't have the shape platform-spec is built for. Want a smaller architecture doc instead?"

### Step 2 — Discovery

Read the codebase to find every candidate module. Do this *before* drafting anything.

- **Routes** — list every top-level route. Note auth-gated routes (still modules). Note standalone routes that render outside the app shell (TV displays, public approval links).
- **Sidebar / nav** — list every entry. Note grouping (children arrays, sub-navigation). Note footer items.
- **Database tables / data objects** — list every owned table. Each table belongs to exactly one module.
- **Existing context files** — `CLAUDE.md`, `README.md`, any `/docs` content. Note legacy code that should be called out as such.

Cross-reference:
- Every route should map to a module.
- Every nav entry should map to a module.
- Every table should have exactly one owning module — flag any that don't.

Resolve dual-purpose routes: a `/crm` index route alongside `/crm/leads` etc. is typically a Module Group landing view, not a separate module.

### Step 3 — Vocabulary walkthrough (short)

Show the user the vocabulary block above and confirm it. Don't make them re-derive it — they're either accepting the default or they want a different skill. Keep this to one message.

### Step 4 — Draft the module catalog

Sort discovered modules into:
1. **Standalone Modules** — most modules, listed in one table.
2. **Module Groups** — only where you have a *cohesive cluster of modules serving one super-capability*. A nav group that just shares a sidebar caret (e.g., Settings + Activity) is **not** a Module Group — those are separate modules that happen to be nav-grouped.

Each module gets: name, **kind** (data-owning / aggregating), one-sentence capability, list of data-objects owned (or `—`).

Be ruthless with kinds. If a module owns one tiny table, it's data-owning. If it presents data from five other modules and owns nothing, it's aggregating.

### Step 5 — Ask only the questions that can't be answered from the code

Possible questions, asked only when genuinely ambiguous:
- Two routes look like they could be one module with two views, or two modules. Which?
- A surface (large-screen view, public approval page) — own module or view of an existing one?
- A nav grouping that doesn't look cohesive — should it be a Module Group anyway?

Use 1–3 questions max, bundled. Each question must explain the trade-off, not just ask "which?"

### Step 6 — Write `docs/spec/platform.md`

Template (substitute project specifics):

```markdown
# <Product> — Platform Specification

<1-paragraph intro: what the platform is, what it does end-to-end, any legacy origin worth noting.>

This is the **platform-level** document. It defines the shared vocabulary and
lists every module. Each module will get its own document under
`docs/spec/modules/`.

---

## Vocabulary

<intro sentence about the intent ladder>

- **Platform** — ...
- **Module Group** — ...
- **Module** — ...
  - **data-owning** — ...
  - **aggregating** — ...
- **View** — ...
- **Component** — ...
- **Data-object** — ...

```
Platform
  └─ [Module Group]                  optional — only for cohesive clusters
       └─ Module ──────── owns ──▶ Data-objects   (the "nouns" axis)
            └─ View
                 └─ Component                     (the "intent" axis)
```

**Navigation placement** is an *attribute* of a module, not part of its definition.

---

## Modules

<intro sentence>

| Module | Kind | Capability | Data-objects owned |
|---|---|---|---|
| **<Name>** | Data-owning / Aggregating | <one-sentence capability> | `table_a`, `table_b` |
...

---

## Module Group: <Name>   (one section per group)

<one-sentence rationale for why this cluster is cohesive>

| Module | Kind | Capability | Data-objects owned |
|---|---|---|---|
...

---

## Navigation

- **Main sidebar:** ...
- **Sidebar footer:** ...
- **Sub-navigation:** ...
- **Direct URL only (no nav entry):** ...
- **Standalone (renders outside the app shell):** ...

---

## Open questions

<numbered list — see "What to flag" below>

---

## How this spec is organised

```
docs/spec/
  platform.md          ← this document
  modules/             ← one document per module (next step)
    <group-name>/
      <module>.md
    <module>.md
```
```

### Step 7 — Open questions: what to flag

Watch for and flag in the doc:
- A nav grouping that isn't a true cohesive cluster (e.g., Settings + Activity sharing a caret). Flag whether to keep as one Module Group or split.
- A surface that could be its own module *or* a view of another (TV display vs Dashboard view; public approval page vs Change Control view). State the call and the trade-off.
- A "module" that owns no data and presents nothing — likely a route stub; flag for removal or merging.
- A data-object with no clear owner, or two modules both claiming one. Resolve before publishing.
- Naming inconsistencies between code, docs, and product name (e.g., legacy product name in `package.json` vs current name in the UI). Flag and recommend a resolution.

### Step 8 — Stop

The skill produces `platform.md` and the folder plan. **Do not** start writing per-module docs in the same turn. Hand back to the user; they choose what module to document next.

---

## Principles to enforce

1. **The intent ladder is recursive intent narrowing.** Platform = whole-product intent. Module = one capability's intent. View = one screen's task. Component = one specific use-case. If two adjacent tiers describe the same scope, collapse them.

2. **Tiers vs attributes vs kinds.** A new tier should only be introduced if it changes *what something is*. If it only changes *where something appears* or *what shape it is*, it's an attribute or a kind. Navigation placement, billable-ness, large-screen-ness are attributes — not tiers.

3. **One source of truth per data-object.** Exactly one module owns each table.

4. **Data-ownership is binary.** Owning zero vs ≥1 data-objects decides the kind. Heavy aggregation does not override ownership.

5. **Push back on the user's calls when reasoning is flawed.** Critical dialogue produces better specs than order-taking. If a proposed grouping collapses two unrelated things, or a proposed tier is really an attribute, say so — even if the user just asked for it. Offer the cleaner alternative, then let them decide.

6. **The vocabulary is fixed for this skill.** If the project genuinely needs different terms, this isn't the right skill — say so plainly. Don't quietly redefine *Module* or *View* to fit something else.

---

## When NOT to use this skill

- A library, CLI tool, or single-purpose app — the platform/module hierarchy adds nothing.
- A greenfield project with no existing code — start with product design instead.
- The user wants a single technical-architecture diagram (data flow, deployment, etc.) — different shape entirely.
- The codebase doesn't have a router, a nav config, or a discoverable data layer — discovery will be guesswork.
