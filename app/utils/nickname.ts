// Adjectives are at most 8 characters and animals at most 7, so every
// generated name fits the 16 character nickname limit.
// prettier-ignore
export const NICKNAME_ADJECTIVES = [
  'Bashful', 'Bouncy', 'Cheeky', 'Chunky', 'Clumsy', 'Cosmic', 'Crispy', 'Dapper',
  'Dizzy', 'Dramatic', 'Feisty', 'Fancy', 'Fluffy', 'Frosty', 'Funky', 'Fuzzy',
  'Giggly', 'Goofy', 'Grumpy', 'Hungry', 'Jolly', 'Lucky', 'Mighty', 'Nerdy',
  'Peppy', 'Plucky', 'Quirky', 'Rowdy', 'Sassy', 'Silly', 'Sleepy', 'Snazzy',
  'Sneaky', 'Snoozy', 'Sparkly', 'Speedy', 'Spicy', 'Squishy', 'Tipsy', 'Turbo',
  'Wobbly', 'Wiggly', 'Zesty', 'Zippy'
]

// prettier-ignore
export const NICKNAME_ANIMALS = [
  'Alpaca', 'Axolotl', 'Badger', 'Beaver', 'Bison', 'Camel', 'Chicken', 'Corgi',
  'Crab', 'Dingo', 'Donkey', 'Duck', 'Ferret', 'Frog', 'Gecko', 'Goat',
  'Goose', 'Hamster', 'Hippo', 'Iguana', 'Kiwi', 'Koala', 'Lemur', 'Llama',
  'Lobster', 'Meerkat', 'Moose', 'Narwhal', 'Newt', 'Ocelot', 'Octopus', 'Ostrich',
  'Otter', 'Owl', 'Panda', 'Parrot', 'Pelican', 'Penguin', 'Pigeon', 'Possum',
  'Pug', 'Puffin', 'Quokka', 'Raccoon', 'Rhino', 'Seal', 'Shrimp', 'Sloth',
  'Squid', 'Tapir', 'Toucan', 'Turtle', 'Unicorn', 'Walrus', 'Weasel', 'Wombat',
  'Yak', 'Zebra'
]

const LEGACY_NICKNAME = /^User_[A-Za-z0-9]{6}$/

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)]!
}

/**
 * Generates a random "Adjective Animal" nickname, e.g. "Sleepy Otter"
 */
export function genAnimalNickname(random: () => number = Math.random): string {
  return `${pick(NICKNAME_ADJECTIVES, random)} ${pick(NICKNAME_ANIMALS, random)}`
}

/** Legacy auto-generated nickname (User_xxxxxx); to be replaced with an animal nickname */
export function isLegacyNickname(nickname: string): boolean {
  return LEGACY_NICKNAME.test(nickname)
}
