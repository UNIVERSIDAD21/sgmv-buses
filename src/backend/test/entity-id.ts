import { randomInt } from 'node:crypto'

// Explicit fixture IDs occupy a high range, apart from sequence-generated application IDs.
// Each isolated test context gets a disjoint practical range and increments within it.
let current = randomInt(100_000_000, 1_900_000_000)
export function testEntityId() {
  return ++current
}
