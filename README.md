# L-plantbox

A small, deterministic L-system engine that stores the plant as a tree (not a string) and rewrites every node in parallel each generation. A turtle renderer (2D canvas first) comes later.

The design is in [docs/](docs/), starting with [docs/spec-0.md](docs/spec-0.md).

## API

```js
const tree = new Engine(['A', '+', '-'], { A: 'A[-A][+A]' }, 'A')
tree.derive()      // one parallel step
tree.derive(n)     // n steps
tree.get()         // 'A[-A][+A]...' (ABOP bracketed notation)
tree.generation    // number of derivations so far
```

Symbols are single characters. Brackets are structure and never part of the alphabet. Symbols with no rule keep themselves (identity rule).

## Running

```sh
npm install
npm run dev
npm test
```

Open the page and use the browser console. `Engine` and `specimens` are available on `window`:

```js
const s = specimens.algae
const t = new Engine(s.alphabet, s.rules, s.axiom)
t.derive(4)
t.get()   // 'abaababa'
```

## Layout

```
src/engine.js     the engine
src/tree.js       node shape, parser, serializer
src/specimens.js  example L-systems as data
src/turtle.js     renderer (later)
src/main.js       wires them together
tests/            test battery (npm test)
docs/             specs
```

## Status

The v1 engine (parser, constructor, derive, serializer) works and is covered by `npm test`. The turtle renderer is not built yet.
