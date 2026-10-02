const words = ['spam', 'scam', 'fuck', 'shit', 'bitch', 'nigger', 'faggot'];

const leet: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

export function skeleton(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[013457@$]/g, (character) => leet[character] ?? character)
    .replace(/([a-z])\1+/g, '$1');
}

export function containsBlockedWord(text: string): boolean {
  const normalized = skeleton(text);
  return words.some((word) => new RegExp(`(^|[^a-z])${word}($|[^a-z])`).test(normalized));
}
