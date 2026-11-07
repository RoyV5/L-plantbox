// Test-only helpers.

/**
 * Print a tree as a bracketed string, asserting along the way that every child
 * (next or branch head) points back to its owner through `parent`.
 * Lets the parser be checked independently of the real serializer.
 */
export function show(node) {
  let out = ''
  for (let n = node; n; n = n.next) {
    if (n.next && n.next.parent !== n) {
      throw new Error(`broken parent link: next of '${n.sym}'`)
    }
    out += n.sym
    for (const b of n.branches) {
      if (b.parent !== n) throw new Error(`broken parent link: branch of '${n.sym}'`)
      out += '[' + show(b) + ']'
    }
  }
  return out
}

/** Set of the distinct characters in `text`, minus brackets and whitespace. */
export function alphabetOf(text) {
  return new Set([...text].filter((c) => c !== '[' && c !== ']' && !/\s/.test(c)))
}
