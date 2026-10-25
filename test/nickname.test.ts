import { describe, expect, it } from 'vitest'
import {
  NICKNAME_ADJECTIVES,
  NICKNAME_ANIMALS,
  genAnimalNickname,
  isLegacyNickname
} from '../app/utils/nickname'

describe('genAnimalNickname', () => {
  it('always fits the 16 character nickname limit', () => {
    const longest =
      Math.max(...NICKNAME_ADJECTIVES.map((a) => a.length)) +
      1 +
      Math.max(...NICKNAME_ANIMALS.map((a) => a.length))
    expect(longest).toBeLessThanOrEqual(16)
  })

  it('combines an adjective and an animal', () => {
    expect(genAnimalNickname(() => 0)).toBe(`${NICKNAME_ADJECTIVES[0]} ${NICKNAME_ANIMALS[0]}`)
    expect(genAnimalNickname(() => 0.9999)).toBe(
      `${NICKNAME_ADJECTIVES.at(-1)} ${NICKNAME_ANIMALS.at(-1)}`
    )
  })

  it('has no duplicate words', () => {
    expect(new Set(NICKNAME_ADJECTIVES).size).toBe(NICKNAME_ADJECTIVES.length)
    expect(new Set(NICKNAME_ANIMALS).size).toBe(NICKNAME_ANIMALS.length)
  })
})

describe('isLegacyNickname', () => {
  it('matches only the old generated format', () => {
    expect(isLegacyNickname('User_95pDUc')).toBe(true)
    expect(isLegacyNickname('User_95pDU')).toBe(false)
    expect(isLegacyNickname('Sleepy Otter')).toBe(false)
    expect(isLegacyNickname('User_Bob')).toBe(false)
  })
})
