// Basic check for contact details in public profile text. The full contact lock
// (numbers spelled out in words, obfuscated emails, digits split across lines)
// is built with the chat and will replace this. Both places will use it.

const OUTSIDE_WORDS = /\b(whats\s?app|telegram|call\s+me|text\s+me|dm\s+me|instagram|facebook)\b/i;

export const CONTACT_INFO_MESSAGE =
  "This can't include phone numbers, emails or links. Customers contact you through Crafteey chat.";

export function containsContactInfo(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();

  if (t.includes("@")) return true;
  if (/(https?:\/\/|www\.)/.test(t)) return true;
  if (/\.(com|net|org|ng|co|io)\b/.test(t)) return true;
  if (OUTSIDE_WORDS.test(t)) return true;

  // Digits with separators: 0803 123 4567, 0803-123-4567, +234 (803) 123 4567
  const compact = t.replace(/(?<=\d)[\s.\-()/]+(?=\d)/g, "");
  if (/\d{9,}/.test(compact)) return true;

  return false;
}