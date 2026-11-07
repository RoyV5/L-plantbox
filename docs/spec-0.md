# L-system Engine v1: Spec

A small, deterministic L-system engine that stores the plant as a tree and derives it in parallel. This spec records the decisions made so far. Anything marked *proposed* has not been confirmed yet.

## 1. Scope

**In scope for v1**

- Deterministic, context-free, non-parametric L-systems.
- Tree representation, `derive`, `get`.
- Rules in ABOP bracketed notation, for example `A => A[-A][+A]`.

**Out of scope (design kept open, see section 9)**

- Parameters, conditions, context-sensitive rules, stochastic rules.
- Carbon, light and environment.
- 3D.
- The turtle renderer, which is a separate component built later (2D canvas first).

## 2. Public API

```js
const tree = new Engine(alphabet, rules, axiom)
tree.derive()      // one parallel step, increments generation
tree.derive(n)     // n steps
tree.get()         // current state as an ABOP bracketed string
tree.generation    // number of derivations so far
```

- `alphabet`: array of single-character strings. It includes `+` and `-` when used. Brackets are structure and are never in the alphabet.
- `rules`: object. Key is a symbol, value is the right-hand side as a string, for example `{ A: 'A[-A][+A]' }`. Symbols without a rule get an identity rule automatically.
- `axiom`: a non-empty string in the grammar of section 4.
- `derive` changes the object in place and returns nothing. State is read with separate calls (`get()`, `generation`).

## 3. Data model

```js
{ sym, params: {}, next, branches: [], parent }
```

- `sym`: the symbol. `params` is always empty in v1 and exists so the parametric version fits the same shape (named params).
- `next`: the single main-chain continuation, or `null`.
- `branches`: lateral chains, in string order.
- `parent`: the node above, whichever of `next` or `branches` led here. Nodes are connected by object references.
- Brackets are not nodes. A branch such as `[-A]` is a chain: the node `-` whose `next` is `A`.
- The tail of a chain is found by following `next` until it is `null`.
- The object keeps a `root` pointer. An empty tree is possible (see section 6), and `get()` then returns an empty string.
- `parent` creates reference cycles, so the tree is never passed to `JSON.stringify`. The serializer is the only export path.

## 4. Input grammar

```
chain  := { item }
item   := symbol | '[' chain ']'
symbol := any single character except '[' ']' and whitespace
```

- The axiom is a non-empty chain. A rule's right-hand side is a chain and may be empty.
- Whitespace is ignored. Symbols are case-sensitive and one character long.
- A bracket group belongs to the nearest preceding symbol in its own chain.
- A chain that starts with `[` is a parse error. This includes a bracket directly after another opening bracket. Reason: the branch would have no owner inside the successor.
- Empty brackets `[]` are a parse error.
- Unbalanced brackets are a parse error.

## 5. Construction

1. Validate the alphabet: single non-whitespace characters, not `[` or `]`, no duplicates.
2. Parse the axiom and every right-hand side with the chain grammar.
3. Every symbol that appears in the axiom or any rule must be in the alphabet, otherwise throw and name the symbol. Every rule key must be a single alphabet symbol. Object keys already guarantee one rule per symbol.
4. Add the identity rule for every alphabet symbol with no rule.
5. Compile each rule's right-hand side into a successor template: a tree of node objects with literal values. The template stores its own head and tail, computed once. An empty right-hand side is stored as `null`.
6. Set `generation = 0` and build the tree from the axiom.

## 6. derive

**Principles**

- The old tree is read-only. A new tree is built from it. When the step finishes, `root` is swapped to the new tree and `generation` increases by one.
- Every old node is rewritten in the same step (parallel rewriting). Nodes created during the step are never rewritten in that step.
- Identity productions still create a fresh copy of the node.
- A call to `derive(n)` is atomic. If any of its n steps fails, the object is unchanged: `root` and `generation` are only updated once every step has succeeded.

**Procedure** `rewrite(old, anchor, slot)`, where `anchor` is the new node the result attaches to and `slot` is `next` or `branch`:

1. Look up the production for `old.sym`. One always exists.
2. If the successor is not empty:
   - Instantiate a fresh copy of the template and attach its head to `anchor` through `slot`. Set `parent`.
   - For each old branch of `old`, in order: `rewrite(branch, tail, 'branch')`.
   - Then, if `old.next` exists: `rewrite(old.next, tail, 'next')`.
   - The successor's own branches therefore come first, then the old branches, then the old continuation.
3. If the successor is empty, no nodes are created, and the old children move up to the anchor:
   - For each old branch: `rewrite(branch, anchor, 'branch')`.
   - Then, if `old.next` exists: `rewrite(old.next, anchor, slot)`.
   - If the removed node headed a branch, its old continuation becomes that branch and its old branches become siblings of it.
4. Start with a sentinel as the anchor for the root. If the sentinel ends up with branches (the root was removed and had branches), throw, since a tree cannot start with a bracket.
5. Walk the `next` chain with a loop and recurse only into branches. A long chain would otherwise overflow the call stack.

**Worked example (algae).** `{ a: 'ab', b: 'a' }`, axiom `a`. The strings are `a`, `ab`, `aba`, `abaab`, `abaababa`.

## 7. get()

Serialize from the root. For each node: write its symbol, then each branch as `[` chain `]`, then continue along `next`. Use a loop along `next` and recursion only for branches.

## 8. Limits and errors

- `MAX_GENERATIONS = 10`. If `generation + n` would exceed it, `derive` throws before doing anything.
- `MAX_NODES = 10000`, a backstop. It is checked while building the new tree. Reason: a rule like `A => A[-A][+A]` triples the `A` count each step, and other rules grow faster. The generation limit alone does not protect against them.
- Errors, each with a clear message: invalid alphabet, symbol not in alphabet, bad rule key, empty axiom, unbalanced brackets, bracket with no preceding symbol, empty brackets, node cap exceeded, generation cap exceeded, root removed with branches.

## 9. Extension points (design only, not built in v1)

- **Parametric rules.** The left side declares named params, as in `F(l)`. A production gains a condition and parameter expressions. All are compiled once into functions that take the matched node: a condition `node → boolean` and a successor `node → subtree`. Expressions are evaluated by a small custom parser behind one `compile(text)` function.
- **Context-sensitive rules.** Left context is the parent. Right context follows `next` and `branches`, as ABOP defines it. Productions gain `left` and `right`. The matcher reads only the old tree. More specific rules are tried first.
- **Stochastic rules.** A probability field. v1 forbids duplicate rules for a symbol for this reason.
- **Leading-bracket successors.** Could be supported by moving the leading branches onto the preceding node. The empty-successor case already uses the same idea.
- **Turtle renderer.** Separate file. Walks the tree depth-first and restores state after each branch. What `+` and `-` mean, and the angle, are renderer settings. 2D canvas first, three.js later.
- **Environment, carbon, light.** Later layers on top of this engine. They are not part of it.

## 10. Tests

Check by hand first, in the console, before any drawing.

1. **Algae.** `a => ab`, `b => a`, axiom `a`. Lengths 1, 2, 3, 5, 8.
2. **Branching.** Alphabet `A + -`, rule `A => A[-A][+A]`, axiom `A`.
   - Generation 1: `A[-A][+A]`.
   - Generation 2: `A[-A][+A][-A[-A][+A]][+A[-A][+A]]`.
   - The number of `A` is 3^n.
3. **Tail attachment.** Rule `A => A[-A][+B]`, axiom `AB`. Result: `A[-A][+B]B`.
4. **Tail is not the head.** Rule `A => A[-A]B[+A]`, axiom `AC`. Result: `A[-A]B[+A]C`.
5. **Round trip.** Parse the output of `get()` and check that it serializes to the same string.
6. **Empty productions.**
   - `B => ''`, axiom `ABC`: result `AC`.
   - `B => ''`, axiom `A[BC]`: result `A[C]`.
   - `B => ''`, axiom `A[B[+C]D]`: result `A[+C][D]`.
   - `B => ''`, axiom `BC`: result `C`.
   - `B => ''`, axiom `B[+C]`: throws (root removed with branches).
7. **Errors.** One case for each error in section 8.
8. **Limits.** The 11th generation throws. A fast-growing rule hits `MAX_NODES` and leaves the object unchanged.

## 11. File layout

```
src/engine.js     the engine
src/tree.js       node shape, parser, serializer
src/turtle.js     renderer (later)
src/specimens.js  alphabet, rules, axiom as data
src/main.js       wires them together
tests/            test battery (npm test)
```

The parser lives in `src/tree.js`, next to the node shape and the serializer.

**Open items**

None. All v1 decisions are settled.
