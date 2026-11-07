import './style.css'
import { Engine } from './engine.js'
import * as specimens from './specimens.js'

// Expose for by-hand testing in the browser console, e.g.
//   const s = specimens.algae; const t = new Engine(s.alphabet, s.rules, s.axiom); t.derive(4); t.get()
window.Engine = Engine
window.specimens = specimens

try {
  const { alphabet, rules, axiom } = specimens.branching
  const tree = new Engine(alphabet, rules, axiom)
  tree.derive(2)
  console.log(`generation ${tree.generation}:`, tree.get())
} catch (err) {
  console.error(err)
}
