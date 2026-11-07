# CLAUDE.md

L-plantbox: a deterministic L-system engine that stores the plant as a tree and derives it in parallel. Vanilla JS, ES modules, Vite.

## The spec is the source of truth

- Specs live in [docs/](docs/) (currently [docs/spec-0.md](docs/spec-0.md); more will follow). Read the relevant one before touching the engine.
- Build only what the current spec lists as in scope. Extension points are design notes, not tasks.
- Anything marked *proposed*, and listed open items, are the user's call. Ask; do not settle them silently in code.
- If an implementation needs to deviate from the spec, stop and agree the change with the user, then update the spec in the same change.
- Do not cite specs in code comments (no file names, section numbers or "per spec" notes). Code and specs both change; comments describe what the code does, on their own terms.

## v1 scope

- Deterministic, context-free, non-parametric only. No parameters, conditions, context-sensitive or stochastic rules, no 3D, no environment/carbon/light.
- `params` exists on every node but stays `{}` in v1.
- One rule per symbol (object keys). Missing rules become identity rules.

## Data model invariants

- Node shape is exactly `{ sym, params, next, branches, parent }`. Do not add fields without asking.
- Brackets are never nodes. `[-A]` is the chain `-` → `A` stored in a parent's `branches`.
- The tree has `parent` cycles: never `JSON.stringify` it. `serialize` / `get()` is the only export path.

## Grammar

- Symbols are single, case-sensitive, non-whitespace characters. `[` and `]` are never in the alphabet. Whitespace is ignored.
- Parse errors: a chain starting with `[` (including `[[`), empty brackets `[]`, unbalanced brackets, symbol not in alphabet (name the symbol).

## derive invariants

- The old tree is read-only. Build a new tree, then swap `root` and increment `generation` only on success. A failed step leaves the object unchanged.
- Parallel rewriting: every old node is rewritten once; nodes created in this step are never rewritten in it.
- Identity productions still create fresh copies.
- Attachment order at the successor's tail: successor's own branches, then old branches, then old `next`.
- Empty successor: old branches and continuation move up to the anchor. Root removed with branches → throw.

## Implementation rules

- Never recurse along `next`. Loop along `next`, recurse (or use an explicit stack) only into branches. Applies to the parser, `derive`, and the serializer.
- `MAX_GENERATIONS` is checked before any work; `MAX_NODES` is checked while building. Both live in `src/engine.js`.
- Every error listed in the spec gets a clear message naming the offending symbol, key or limit.
- `src/engine.js` and `src/tree.js` are pure: no DOM, canvas or renderer code. What `+`/`-` mean belongs to the renderer.
- Keep it small and readable. No new dependencies without asking.
- Clean code over convenience. Never propose or recommend a shortcut that sacrifices clarity or honest semantics (e.g. returning `this` from a mutating method to allow chaining). If a cleaner option exists, recommend that one.
- `derive` mutates in place and returns nothing. Read state with separate calls (`get()`, `generation`).

## Testing

- Tests live in `tests/` and run with `npm test` (Node's built-in `node:test`, no dependencies). Never verify with throwaway scripts only: checks belong in `tests/`.
- Every new feature lands with its tests. Add the spec's test cases as soon as the code they need exists.
- `tests/helpers.js` has `show(node)`, a test-only printer that also checks `parent` links.
- `Engine` and `specimens` are also exposed on `window` by `src/main.js` for poking around in the browser console.

## Commands

- `npm run dev`: dev server
- `npm test`: run the test battery
- `npm run build`: production build (also a quick check for broken imports)
