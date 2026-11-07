// Node shape, parser and serializer.
// No DOM or renderer code in this file.

/**
 * Create a detached node.
 * `params` is always empty in v1; it exists so the parametric version fits the same shape.
 * @param {string} sym single-character symbol
 */
export function createNode(sym) {
  return { sym, params: {}, next: null, branches: [], parent: null }
}

/**
 * Follow `next` from `head` to the last node of the chain.
 * @param {object|null} head
 * @returns {object|null}
 */
export function chainTail(head) {
  let node = head
  while (node && node.next) node = node.next
  return node
}

const WHITESPACE = /\s/

/**
 * Parse a chain into a linked tree of nodes.
 *
 *   chain  := { item }
 *   item   := symbol | '[' chain ']'
 *   symbol := any single character except '[' ']' and whitespace
 *
 * Whitespace is ignored. A bracket group belongs to the nearest preceding symbol in its chain.
 * Errors: bracket with no preceding symbol (a chain starting with '['), empty brackets '[]',
 * unbalanced brackets, symbol not in alphabet.
 *
 * Iterative: an explicit stack of open chains, so neither long chains nor deep nesting
 * can overflow the call stack.
 *
 * @param {string} text
 * @param {Set<string>} alphabet
 * @returns {object|null} head node, or null for an empty chain
 */
export function parseChain(text, alphabet) {
  // Each frame is one open chain: the node that owns it (null for the outermost chain),
  // its first and last nodes so far, and where its '[' was.
  const stack = [{ owner: null, head: null, last: null, openedAt: -1 }]

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const frame = stack[stack.length - 1]

    if (WHITESPACE.test(c)) continue

    if (c === '[') {
      if (frame.last === null) {
        throw new Error(`bracket with no preceding symbol at position ${i} in '${text}'`)
      }
      stack.push({ owner: frame.last, head: null, last: null, openedAt: i })
      continue
    }

    if (c === ']') {
      if (stack.length === 1) {
        throw new Error(`unbalanced brackets: unexpected ']' at position ${i} in '${text}'`)
      }
      stack.pop()
      if (frame.head === null) {
        throw new Error(`empty brackets at position ${frame.openedAt} in '${text}'`)
      }
      frame.owner.branches.push(frame.head)
      frame.head.parent = frame.owner
      continue
    }

    if (!alphabet.has(c)) {
      throw new Error(`symbol '${c}' is not in the alphabet (position ${i} in '${text}')`)
    }
    const node = createNode(c)
    if (frame.last === null) {
      frame.head = node
    } else {
      frame.last.next = node
      node.parent = frame.last
    }
    frame.last = node
  }

  if (stack.length > 1) {
    const open = stack[stack.length - 1]
    throw new Error(`unbalanced brackets: '[' at position ${open.openedAt} is never closed in '${text}'`)
  }
  return stack[0].head
}

/**
 * Serialize a tree to an ABOP bracketed string.
 * For each node: symbol, then each branch as '[' chain ']', then continue along `next`.
 * Returns '' for a null root.
 * This is the only export path: the tree has `parent` cycles, never JSON.stringify it.
 *
 * Iterative: an explicit stack of pending nodes and bracket tokens, so neither long
 * chains nor deep nesting can overflow the call stack.
 *
 * @param {object|null} root
 * @returns {string}
 */
export function serialize(root) {
  let out = ''
  const stack = root ? [root] : []
  while (stack.length) {
    const item = stack.pop()
    if (typeof item === 'string') {
      out += item
      continue
    }
    out += item.sym
    // Pushed in reverse so they pop in order: each branch, then the continuation.
    if (item.next) stack.push(item.next)
    for (let i = item.branches.length - 1; i >= 0; i--) {
      stack.push(']', item.branches[i], '[')
    }
  }
  return out
}
