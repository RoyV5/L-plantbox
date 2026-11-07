import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { Engine, MAX_GENERATIONS, MAX_NODES } from '../src/engine.js'
import { parseChain } from '../src/tree.js'
import * as specimens from '../src/specimens.js'
import { show } from './helpers.js'

const fromSpecimen = (s) => new Engine(s.alphabet, s.rules, s.axiom)

/** Derive n steps and return the new state, checking parent links along the way. */
function after(engine, n) {
  engine.derive(n)
  const text = engine.get()
  assert.equal(show(engine.root), text)
  return text
}

/** Every node object reachable from root, to compare node identity across trees. */
function nodesOf(root) {
  const nodes = new Set()
  const stack = root ? [root] : []
  while (stack.length) {
    const node = stack.pop()
    nodes.add(node)
    if (node.next) stack.push(node.next)
    stack.push(...node.branches)
  }
  return nodes
}

const count = (text, sym) => [...text].filter((c) => c === sym).length

describe('derive: basic rewriting', () => {
  test('algae: a, ab, aba, abaab, abaababa', () => {
    const e = fromSpecimen(specimens.algae)
    const expected = ['a', 'ab', 'aba', 'abaab', 'abaababa']
    assert.equal(e.get(), expected[0])
    for (let g = 1; g < expected.length; g++) {
      assert.equal(after(e, 1), expected[g])
      assert.equal(e.generation, g)
    }
  })

  test('algae lengths follow Fibonacci', () => {
    const e = fromSpecimen(specimens.algae)
    const lengths = [e.get().length]
    for (let g = 1; g <= 4; g++) lengths.push(after(e, 1).length)
    assert.deepEqual(lengths, [1, 2, 3, 5, 8])
  })

  test('branching: generations 1 and 2', () => {
    const e = fromSpecimen(specimens.branching)
    assert.equal(after(e, 1), 'A[-A][+A]')
    assert.equal(after(e, 1), 'A[-A][+A][-A[-A][+A]][+A[-A][+A]]')
  })

  test('branching: number of A is 3^n', () => {
    const e = fromSpecimen(specimens.branching)
    for (let g = 1; g <= 6; g++) assert.equal(count(after(e, 1), 'A'), 3 ** g)
  })

  test('tail attachment: AB -> A[-A][+B]B', () => {
    assert.equal(after(fromSpecimen(specimens.tailAttachment), 1), 'A[-A][+B]B')
  })

  test('tail is not the head: AC -> A[-A]B[+A]C', () => {
    assert.equal(after(fromSpecimen(specimens.tailNotHead), 1), 'A[-A]B[+A]C')
  })

  test('old branches attach to the tail after the successor branches', () => {
    const e = new Engine(['A', 'B', 'C', '+', '-'], { A: 'A[-A]B[+A]' }, 'A[C]')
    assert.equal(after(e, 1), 'A[-A]B[+A][C]')
  })

  test('derive(n) equals n single steps', () => {
    const a = fromSpecimen(specimens.branching)
    const b = fromSpecimen(specimens.branching)
    a.derive(4)
    for (let i = 0; i < 4; i++) b.derive()
    assert.equal(a.get(), b.get())
    assert.equal(a.generation, 4)
    assert.equal(b.generation, 4)
  })

  test('derive(0) changes nothing', () => {
    const e = fromSpecimen(specimens.algae)
    const root = e.root
    e.derive(0)
    assert.equal(e.root, root)
    assert.equal(e.generation, 0)
  })

  test('derive returns nothing', () => {
    assert.equal(fromSpecimen(specimens.algae).derive(), undefined)
  })

  test('round trip: parsing get() output serializes to the same string', () => {
    const e = fromSpecimen(specimens.branching)
    e.derive(3)
    const text = e.get()
    assert.equal(show(parseChain(text, e.alphabet)), text)
  })
})

describe('derive: tree integrity', () => {
  test('the old tree is not modified', () => {
    const e = fromSpecimen(specimens.tailNotHead)
    const oldRoot = e.root
    const before = show(oldRoot)
    e.derive()
    assert.equal(show(oldRoot), before)
  })

  test('identity rules still create fresh nodes', () => {
    const e = new Engine(['A', 'B'], {}, 'A[B]A')
    const oldNodes = nodesOf(e.root)
    e.derive()
    assert.equal(e.get(), 'A[B]A')
    for (const node of nodesOf(e.root)) assert.ok(!oldNodes.has(node))
  })

  test('templates are copied, never inserted or modified', () => {
    const e = fromSpecimen(specimens.tailNotHead)
    const template = e.productions.get('A')
    const templateNodes = nodesOf(template.head)
    e.derive(2)
    assert.equal(show(template.head), 'A[-A]B[+A]')
    for (const node of nodesOf(e.root)) assert.ok(!templateNodes.has(node))
  })

  test('new root has no parent', () => {
    const e = fromSpecimen(specimens.branching)
    e.derive()
    assert.equal(e.root.parent, null)
  })

  test('nodes created in a step are not rewritten in that step', () => {
    const e = new Engine(['A'], { A: 'AA' }, 'A')
    assert.equal(after(e, 1), 'AA')
    assert.equal(after(e, 1), 'AAAA')
  })

  test('long chain does not overflow the stack', () => {
    const n = MAX_NODES
    const e = new Engine(['A'], {}, 'A'.repeat(n))
    e.derive()
    assert.equal(e.get().length, n)
  })

  test('deep nesting does not overflow the stack', () => {
    const depth = 3_000
    const text = 'A['.repeat(depth) + 'A' + ']'.repeat(depth)
    const e = new Engine(['A'], {}, text)
    e.derive()
    assert.equal(e.get(), text)
  })
})

describe('derive: empty successors bridge the gap', () => {
  const ABCD = ['A', 'B', 'C', 'D', 'X', '+', '-']
  const deleteB = (axiom) => new Engine(ABCD, { B: '' }, axiom)

  const cases = [
    ['middle of the main chain', 'ABC', 'AC'],
    ['head of a branch', 'A[BC]', 'A[C]'],
    ['head of a branch with its own branches', 'A[B[+C]D]', 'A[+C][D]'],
    ['head of a branch with branches, among siblings', 'A[X][B[+C]D][X]', 'A[X][+C][D][X]'],
    ['inside a branch chain', 'A[XB[+C]D]', 'A[X[+C]D]'],
    ['whole branch removed', 'A[B]C', 'AC'],
    ['whole branch of several removed', 'A[BBB]C', 'AC'],
    ['several in a row on the main chain', 'ABBBC', 'AC'],
    ['several in a row heading a branch', 'A[BBC]', 'A[C]'],
    ['main-chain node with branches', 'AB[+C]D', 'A[+C]D'],
    ['main-chain node with branches, last in chain', 'AB[+C]', 'A[+C]'],
    ['nested removals', 'A[B[B[C]]D]', 'A[C][D]'],
    ['root removed', 'BC', 'C'],
    ['several roots removed', 'BBC', 'C'],
    ['root removed, continuation keeps its branches', 'BC[+D]', 'C[+D]'],
    ['everything removed', 'B', ''],
    ['everything removed, several nodes', 'BBB', ''],
  ]
  for (const [label, axiom, expected] of cases) {
    test(`${label}: ${axiom} -> ${expected || "''"}`, () => {
      assert.equal(after(deleteB(axiom), 1), expected)
    })
  }

  test('removal right after a successor tail', () => {
    const e = new Engine(ABCD, { A: 'A[-A]', B: '' }, 'AB[+C]D')
    assert.equal(after(e, 1), 'A[-A][+C]D')
  })

  test('removal right after a multi-node successor uses its tail', () => {
    const e = new Engine(ABCD, { A: 'A[-A]X[+A]', B: '' }, 'ABC')
    assert.equal(after(e, 1), 'A[-A]X[+A]C')
  })

  test('empty tree stays empty', () => {
    const e = deleteB('B')
    e.derive()
    assert.equal(e.root, null)
    e.derive()
    assert.equal(e.root, null)
    assert.equal(e.get(), '')
    assert.equal(e.generation, 2)
  })

  test('removal over several generations', () => {
    // B appears, then disappears the next step.
    const e = new Engine(['A', 'B'], { A: 'AB', B: '' }, 'A')
    assert.equal(after(e, 1), 'AB')
    assert.equal(after(e, 1), 'AB')
  })

  test('root removed with branches throws', () => {
    assert.throws(() => deleteB('B[+C]').derive(), { message: /root removed with branches/ })
  })

  test('several roots removed, the last with branches, throws', () => {
    assert.throws(() => deleteB('BB[+C]').derive(), { message: /root removed with branches/ })
  })
})

describe('derive: limits and atomicity', () => {
  test(`generation ${MAX_GENERATIONS + 1} throws`, () => {
    const e = fromSpecimen(specimens.algae)
    e.derive(MAX_GENERATIONS)
    assert.throws(() => e.derive(), { message: /generation cap exceeded/ })
    assert.equal(e.generation, MAX_GENERATIONS)
  })

  test('generation cap is checked before any work', () => {
    const e = fromSpecimen(specimens.algae)
    e.derive(3)
    const root = e.root
    assert.throws(() => e.derive(MAX_GENERATIONS), { message: /generation cap exceeded: 3 \+ 10/ })
    assert.equal(e.root, root)
    assert.equal(e.generation, 3)
  })

  test('invalid n throws', () => {
    const e = fromSpecimen(specimens.algae)
    for (const n of [-1, 1.5, '2', NaN, null]) {
      assert.throws(() => e.derive(n), { message: /n must be a non-negative integer/ })
    }
    assert.equal(e.generation, 0)
  })

  test('node cap: a fast-growing rule throws and leaves the engine unchanged', () => {
    const e = new Engine(['A'], { A: 'AAAA' }, 'A')
    e.derive(2)
    const root = e.root
    const text = e.get()
    assert.throws(() => e.derive(5), { message: /node cap exceeded/ })
    assert.equal(e.root, root)
    assert.equal(e.get(), text)
    assert.equal(e.generation, 2)
  })

  test('failing in a later step of derive(n) keeps earlier steps uncommitted', () => {
    // Removal leaves B[+C] at the root only in the second step.
    const e = new Engine(['A', 'B', 'C', '+'], { A: 'B', B: '' }, 'A[+C]')
    assert.throws(() => e.derive(2), { message: /root removed with branches/ })
    assert.equal(e.get(), 'A[+C]')
    assert.equal(e.generation, 0)
  })

  test('the engine still works after a failed derive', () => {
    const e = new Engine(['A'], { A: 'AAAA' }, 'A')
    assert.throws(() => e.derive(MAX_GENERATIONS))
    e.derive(1)
    assert.equal(e.get(), 'AAAA')
  })
})
