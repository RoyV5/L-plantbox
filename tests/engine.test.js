import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { Engine } from '../src/engine.js'
import * as specimens from '../src/specimens.js'
import { show } from './helpers.js'

const AB = ['A', 'B', '+', '-']
const make = (alphabet, rules, axiom) => () => new Engine(alphabet, rules, axiom)

describe('Engine constructor: valid input', () => {
  for (const [name, s] of Object.entries(specimens)) {
    test(`specimen '${name}' constructs`, () => {
      const e = new Engine(s.alphabet, s.rules, s.axiom)
      assert.equal(e.generation, 0)
      assert.equal(show(e.root), s.axiom.replace(/\s/g, ''))
      assert.deepEqual([...e.productions.keys()].sort(), [...s.alphabet].sort())
    })
  }

  test('alphabet is stored as a Set', () => {
    const e = new Engine(AB, {}, 'A')
    assert.ok(e.alphabet instanceof Set)
    assert.deepEqual([...e.alphabet], AB)
  })

  test('template head and tail differ when the main chain has several nodes', () => {
    const e = new Engine(['A', 'B', '+', '-'], { A: 'A[-A]B[+A]' }, 'A')
    const { head, tail } = e.productions.get('A')
    assert.equal(show(head), 'A[-A]B[+A]')
    assert.equal(head.sym, 'A')
    assert.equal(tail.sym, 'B')
    assert.equal(tail, head.next)
  })

  test('template head is the tail when the main chain has one node', () => {
    const e = new Engine(['A', '+', '-'], { A: 'A[-A][+A]' }, 'A')
    const { head, tail } = e.productions.get('A')
    assert.equal(head, tail)
  })

  test('symbol with no rule gets a one-node identity template', () => {
    const e = new Engine(AB, { A: 'AB' }, 'A')
    const { head, tail } = e.productions.get('B')
    assert.equal(head, tail)
    assert.equal(head.sym, 'B')
    assert.equal(head.next, null)
    assert.equal(head.branches.length, 0)
  })

  test('empty right-hand side is stored as null', () => {
    const e = new Engine(AB, { B: '' }, 'AB')
    assert.equal(e.productions.get('B'), null)
  })

  test('whitespace-only right-hand side is empty too', () => {
    const e = new Engine(AB, { B: '   ' }, 'AB')
    assert.equal(e.productions.get('B'), null)
  })

  test('whitespace in axiom and rules is ignored', () => {
    const e = new Engine(AB, { A: ' A [ -B ] ' }, ' A B ')
    assert.equal(show(e.root), 'AB')
    assert.equal(show(e.productions.get('A').head), 'A[-B]')
  })

  test('templates are separate from the tree', () => {
    const e = new Engine(AB, {}, 'A')
    assert.notEqual(e.productions.get('A').head, e.root)
  })
})

describe('Engine constructor: alphabet errors', () => {
  const cases = [
    ['not an array', 'AB', /invalid alphabet: must be an array/],
    ['multi-character entry', ['AB'], /invalid alphabet: "AB" is not a single character/],
    ['empty-string entry', [''], /invalid alphabet: "" is not a single character/],
    ['non-string entry', [1], /invalid alphabet: 1 is not a single character/],
    ['whitespace entry', ['A', ' '], /invalid alphabet: whitespace/],
    ['opening bracket', ['A', '['], /invalid alphabet: '\[' is structure/],
    ['closing bracket', ['A', ']'], /invalid alphabet: '\]' is structure/],
    ['duplicate', ['A', 'B', 'A'], /invalid alphabet: 'A' appears more than once/],
  ]
  for (const [label, alphabet, message] of cases) {
    test(label, () => {
      assert.throws(make(alphabet, {}, 'A'), { message })
    })
  }
})

describe('Engine constructor: axiom errors', () => {
  const cases = [
    ['empty string', '', /empty axiom/],
    ['whitespace only', '  \n', /empty axiom/],
    ['not a string', 42, /empty axiom/],
    ['missing', undefined, /empty axiom/],
    ['symbol not in alphabet', 'AX', /^axiom: symbol 'X' is not in the alphabet/],
    ['leading bracket', '[A]', /^axiom: bracket with no preceding symbol/],
    ['empty brackets', 'A[]', /^axiom: empty brackets/],
    ['unclosed bracket', 'A[B', /^axiom: unbalanced brackets/],
    ['stray closing bracket', 'A]', /^axiom: unbalanced brackets/],
  ]
  for (const [label, axiom, message] of cases) {
    test(label, () => {
      assert.throws(make(AB, {}, axiom), { message })
    })
  }
})

describe('Engine constructor: rule errors', () => {
  const cases = [
    ['rules is null', null, /rules must be an object/],
    ['rules is an array', ['A'], /rules must be an object/],
    ['rules is a string', 'A=>AB', /rules must be an object/],
    ['multi-character key', { AB: 'A' }, /bad rule key 'AB'/],
    ['key not in alphabet', { X: 'A' }, /bad rule key 'X'/],
    ['key is a bracket', { '[': 'A' }, /bad rule key '\['/],
    ['non-string right-hand side', { A: 3 }, /rule 'A': right-hand side must be a string/],
    ['null right-hand side', { A: null }, /rule 'A': right-hand side must be a string/],
    ['symbol not in alphabet', { A: 'AZ' }, /^rule 'A': symbol 'Z' is not in the alphabet/],
    ['leading bracket', { A: '[B]A' }, /^rule 'A': bracket with no preceding symbol/],
    ['empty brackets', { A: 'A[]' }, /^rule 'A': empty brackets/],
    ['unbalanced brackets', { A: 'A[B' }, /^rule 'A': unbalanced brackets/],
  ]
  for (const [label, rules, message] of cases) {
    test(label, () => {
      assert.throws(make(AB, rules, 'A'), { message })
    })
  }
})
