// The engine: deterministic, context-free, non-parametric L-system.
// No DOM or renderer code in this file.

import { createNode, chainTail, parseChain, serialize } from './tree.js'

/** `derive` throws before doing anything if generation + n would exceed this. */
export const MAX_GENERATIONS = 10

/** Backstop against fast-growing rules. Checked while building the new tree. */
export const MAX_NODES = 10_000

export class Engine {
  /**
   * Validates the input, compiles every rule into a successor template and builds the
   * tree from the axiom. Throws on any invalid input, so no half-built engine exists.
   *
   * `productions` maps each alphabet symbol to its successor template: the parsed
   * right-hand side as `{ head, tail }` (tail = last node of the main chain, where the
   * rewritten node's old children reattach), or `null` when the right-hand side is empty.
   * Symbols with no rule get a one-node identity template.
   *
   * @param {string[]} alphabet single characters, never '[' or ']'
   * @param {Record<string, string>} rules symbol -> right-hand side
   * @param {string} axiom non-empty chain
   */
  constructor(alphabet, rules, axiom) {
    this.alphabet = validateAlphabet(alphabet)

    if (typeof axiom !== 'string' || axiom.trim() === '') {
      throw new Error('empty axiom: the axiom must contain at least one symbol')
    }
    const root = parse(axiom, this.alphabet, 'axiom')

    if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) {
      throw new Error('rules must be an object mapping symbols to right-hand sides')
    }
    this.productions = new Map()
    for (const [key, rhs] of Object.entries(rules)) {
      if (key.length !== 1 || !this.alphabet.has(key)) {
        throw new Error(`bad rule key '${key}': must be a single symbol from the alphabet`)
      }
      if (typeof rhs !== 'string') {
        throw new Error(`rule '${key}': right-hand side must be a string`)
      }
      const head = parse(rhs, this.alphabet, `rule '${key}'`)
      this.productions.set(key, head === null ? null : { head, tail: chainTail(head) })
    }

    for (const sym of this.alphabet) {
      if (!this.productions.has(sym)) {
        const node = createNode(sym)
        this.productions.set(sym, { head: node, tail: node })
      }
    }

    this.generation = 0
    this.root = root
  }

  /**
   * Run n parallel rewriting steps, in place. Each step reads the current tree without
   * changing it and builds a new one. `root` and `generation` are only updated once all
   * n steps succeed, so on any error the engine is unchanged.
   *
   * @param {number} [n=1] non-negative integer
   */
  derive(n = 1) {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`derive: n must be a non-negative integer, got ${n}`)
    }
    if (this.generation + n > MAX_GENERATIONS) {
      throw new Error(
        `generation cap exceeded: ${this.generation} + ${n} is more than ${MAX_GENERATIONS}`,
      )
    }
    let root = this.root
    for (let step = 1; step <= n; step++) {
      root = rewrite(root, this.productions, this.generation + step)
    }
    this.root = root
    this.generation += n
  }

  /**
   * Current state as an ABOP bracketed string ('' for an empty tree).
   * @returns {string}
   */
  get() {
    return serialize(this.root)
  }
}

function validateAlphabet(alphabet) {
  if (!Array.isArray(alphabet)) {
    throw new Error('invalid alphabet: must be an array of single-character strings')
  }
  const set = new Set()
  for (const sym of alphabet) {
    if (typeof sym !== 'string' || sym.length !== 1) {
      throw new Error(`invalid alphabet: ${JSON.stringify(sym)} is not a single character`)
    }
    if (/\s/.test(sym)) {
      throw new Error(`invalid alphabet: whitespace ${JSON.stringify(sym)} is not a symbol`)
    }
    if (sym === '[' || sym === ']') {
      throw new Error(`invalid alphabet: '${sym}' is structure, not a symbol`)
    }
    if (set.has(sym)) {
      throw new Error(`invalid alphabet: '${sym}' appears more than once`)
    }
    set.add(sym)
  }
  return set
}

/**
 * One parallel step: build a new tree from `oldRoot`, which is only read.
 *
 * Every old node is visited once with an anchor (the new node its result hangs from)
 * and a slot ('next' or 'branch'). A non-empty successor is copied in at that spot and
 * its tail becomes the anchor for the old node's children. An empty successor creates
 * nothing: the old children keep the same anchor, and the continuation keeps the same
 * slot, which bridges the gap left by the removed node.
 *
 * Children are visited in order (old branches, then old continuation) via an explicit
 * stack, so attachment order matches string order and nothing recurses.
 */
function rewrite(oldRoot, productions, generation) {
  const sentinel = createNode('')
  let created = 0
  const work = oldRoot ? [{ old: oldRoot, anchor: sentinel, slot: 'next' }] : []

  while (work.length) {
    const { old, anchor, slot } = work.pop()
    const template = productions.get(old.sym)
    let childAnchor = anchor
    let nextSlot = slot

    if (template) {
      const copy = instantiate(template)
      created += copy.count
      if (created > MAX_NODES) {
        throw new Error(`node cap exceeded: generation ${generation} would have more than ${MAX_NODES} nodes`)
      }
      attach(anchor, slot, copy.head)
      childAnchor = copy.tail
      nextSlot = 'next'
    }

    if (old.next) work.push({ old: old.next, anchor: childAnchor, slot: nextSlot })
    for (let i = old.branches.length - 1; i >= 0; i--) {
      work.push({ old: old.branches[i], anchor: childAnchor, slot: 'branch' })
    }
  }

  if (sentinel.branches.length) {
    throw new Error(
      `root removed with branches: generation ${generation} would start with a bracket`,
    )
  }
  const root = sentinel.next
  if (root) root.parent = null
  return root
}

/** Fresh copy of a successor template, with the copy's head and tail and its node count. */
function instantiate(template) {
  const holder = createNode('')
  let tail = null
  let count = 0
  const work = [{ src: template.head, anchor: holder, slot: 'next' }]

  while (work.length) {
    const { src, anchor, slot } = work.pop()
    const node = createNode(src.sym)
    count++
    attach(anchor, slot, node)
    if (src === template.tail) tail = node
    if (src.next) work.push({ src: src.next, anchor: node, slot: 'next' })
    for (let i = src.branches.length - 1; i >= 0; i--) {
      work.push({ src: src.branches[i], anchor: node, slot: 'branch' })
    }
  }

  const head = holder.next
  head.parent = null
  return { head, tail, count }
}

function attach(anchor, slot, node) {
  if (slot === 'next') anchor.next = node
  else anchor.branches.push(node)
  node.parent = anchor
}

/** parseChain with the error message prefixed by where the text came from. */
function parse(text, alphabet, where) {
  try {
    return parseChain(text, alphabet)
  } catch (err) {
    throw new Error(`${where}: ${err.message}`, { cause: err })
  }
}
