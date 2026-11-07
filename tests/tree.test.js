import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createNode, chainTail, parseChain, serialize } from '../src/tree.js'
import { show, alphabetOf } from './helpers.js'

const ABC = new Set(['A', 'B', 'C', 'D', 'E', '+', '-'])
const parse = (text, alphabet = ABC) => parseChain(text, alphabet)

describe('createNode', () => {
  test('has the node shape with empty links', () => {
    assert.deepEqual(createNode('A'), { sym: 'A', params: {}, next: null, branches: [], parent: null })
  })

  test('each node gets its own params and branches', () => {
    const a = createNode('A')
    const b = createNode('A')
    assert.notEqual(a.params, b.params)
    assert.notEqual(a.branches, b.branches)
  })
})

describe('chainTail', () => {
  test('null for null', () => {
    assert.equal(chainTail(null), null)
  })

  test('a single node is its own tail', () => {
    const a = createNode('A')
    assert.equal(chainTail(a), a)
  })

  test('follows next only, not branches', () => {
    const head = parse('A[-A]B[+A]')
    const tail = chainTail(head)
    assert.equal(tail.sym, 'B')
    assert.equal(tail, head.next)
  })
})

describe('parseChain: valid input', () => {
  test('empty and whitespace-only text give null', () => {
    assert.equal(parse(''), null)
    assert.equal(parse('  \n\t '), null)
  })

  for (const text of ['A', 'ABC', 'A[B]C', 'A[B][C]', 'A[B[C]D]E', 'A[-A]B[+A]', 'A[-A][+A][-A[-A][+A]]']) {
    test(`'${text}' parses to the same structure`, () => {
      assert.equal(show(parse(text)), text)
    })
  }

  test('linear chain is linked through next', () => {
    const a = parse('ABC')
    assert.equal(a.sym, 'A')
    assert.equal(a.next.sym, 'B')
    assert.equal(a.next.next.sym, 'C')
    assert.equal(a.next.next.next, null)
    assert.equal(a.parent, null)
  })

  test('brackets are not nodes', () => {
    const a = parse('A[B]')
    assert.equal(a.next, null)
    assert.equal(a.branches.length, 1)
    assert.equal(a.branches[0].sym, 'B')
    assert.equal(a.branches[0].parent, a)
  })

  test('branches keep string order', () => {
    const a = parse('A[B][C][D]')
    assert.deepEqual(a.branches.map((b) => b.sym), ['B', 'C', 'D'])
  })

  test('a bracket group belongs to the nearest preceding symbol', () => {
    const a = parse('AB[C]')
    assert.equal(a.branches.length, 0)
    assert.equal(a.next.branches[0].sym, 'C')
  })

  test('a branch is a chain: [-A] is - with next A', () => {
    const branch = parse('A[-A]').branches[0]
    assert.equal(branch.sym, '-')
    assert.equal(branch.next.sym, 'A')
    assert.equal(branch.next.parent, branch)
  })

  test('whitespace is ignored', () => {
    assert.equal(show(parse(' A [ B ]\n C ')), 'A[B]C')
  })

  test('symbols are case-sensitive', () => {
    const a = parse('aA', new Set(['a', 'A']))
    assert.equal(a.sym, 'a')
    assert.equal(a.next.sym, 'A')
  })

  test('long chain does not overflow the stack', () => {
    const n = 100_000
    let node = parse('A'.repeat(n))
    let count = 0
    while (node) {
      count++
      node = node.next
    }
    assert.equal(count, n)
  })

  test('deep nesting does not overflow the stack', () => {
    const depth = 10_000
    let node = parse('A['.repeat(depth) + 'A' + ']'.repeat(depth))
    let levels = 0
    while (node.branches.length) {
      assert.equal(node.branches.length, 1)
      assert.equal(node.branches[0].parent, node)
      node = node.branches[0]
      levels++
    }
    assert.equal(levels, depth)
  })
})

describe('parseChain: errors', () => {
  const cases = [
    ['leading bracket', '[A]', /bracket with no preceding symbol at position 0/],
    ['bracket right after bracket', 'A[[B]]', /bracket with no preceding symbol at position 2/],
    ['leading bracket after whitespace', '  [A]', /bracket with no preceding symbol/],
    ['empty brackets', 'A[]', /empty brackets at position 1/],
    ['empty brackets with whitespace', 'A[ ]', /empty brackets/],
    ['unclosed bracket', 'A[B', /unbalanced brackets: '\[' at position 1 is never closed/],
    ['unclosed nested bracket', 'A[B[C]', /unbalanced brackets/],
    ['stray closing bracket', 'A]', /unbalanced brackets: unexpected '\]' at position 1/],
    ['extra closing bracket', 'A[B]]', /unbalanced brackets: unexpected '\]' at position 4/],
    ['symbol not in alphabet', 'AXB', /symbol 'X' is not in the alphabet/],
    ['symbol not in alphabet inside a branch', 'A[BZ]', /symbol 'Z' is not in the alphabet/],
  ]
  for (const [label, text, message] of cases) {
    test(label, () => {
      assert.throws(() => parse(text), { message })
    })
  }

  test('alphabetOf helper matches what the parser accepts', () => {
    const text = 'F[+F]F[-F]F'
    assert.equal(show(parseChain(text, alphabetOf(text))), text)
  })
})

describe('serialize', () => {
  test('null root gives an empty string', () => {
    assert.equal(serialize(null), '')
  })

  for (const text of ['A', 'ABC', 'A[B]C', 'A[B][C]', 'A[B[C]D]E', 'A[-A]B[+A]', 'A[-A][+A][-A[-A][+A]][+A[-A][+A]]']) {
    test(`round trip '${text}'`, () => {
      assert.equal(serialize(parse(text)), text)
    })
  }

  test('round trip drops whitespace', () => {
    assert.equal(serialize(parse(' A [ B ] C ')), 'A[B]C')
  })

  test('long chain does not overflow the stack', () => {
    const text = 'A'.repeat(100_000)
    assert.equal(serialize(parse(text)), text)
  })

  test('deep nesting does not overflow the stack', () => {
    const depth = 10_000
    const text = 'A['.repeat(depth) + 'A' + ']'.repeat(depth)
    assert.equal(serialize(parse(text)), text)
  })
})
