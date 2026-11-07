// L-systems as plain data: { alphabet, rules, axiom }.

export const algae = {
  alphabet: ['a', 'b'],
  rules: { a: 'ab', b: 'a' },
  axiom: 'a',
}

export const branching = {
  alphabet: ['A', '+', '-'],
  rules: { A: 'A[-A][+A]' },
  axiom: 'A',
}

export const tailAttachment = {
  alphabet: ['A', 'B', '+', '-'],
  rules: { A: 'A[-A][+B]' },
  axiom: 'AB',
}

export const tailNotHead = {
  alphabet: ['A', 'B', 'C', '+', '-'],
  rules: { A: 'A[-A]B[+A]' },
  axiom: 'AC',
}
