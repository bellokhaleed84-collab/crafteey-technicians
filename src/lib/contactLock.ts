// Contact lock. Decides whether a chat message (or profile text) tries to share
// contact details or move the customer away from Crafteey. It is a pure
// function with no imports, so the server and the app can both use it.
//
// It cannot catch photos of a phone number, or a number split across several
// separate messages. Admin review of reported chats covers those.

export type LockReason = "phone" | "email" | "link" | "social" | "outside_contact" | "payment_outside";

export type LockResult = { blocked: false } | { blocked: true; reason: LockReason };

export const CONTACT_LOCK_MESSAGE =
  "Message not sent. For your safety, keep contact details, links and payments inside Crafteey.";

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", oh: "0", nought: "0", naught: "0",
  one: "1", won: "1",
  two: "2", too: "2",
  three: "3", tree: "3",
  four: "4", for: "4", fore: "4",
  five: "5", fiv: "5",
  six: "6",
  seven: "7",
  eight: "8", ate: "8",
  nine: "9", nain: "9",
};

// Words that are only read as digits when they sit next to other number words
// or digits. "for" and "too" on their own are just normal words.
const WEAK_WORDS = new Set(["for", "fore", "too", "won", "ate", "oh"]);

const MULTIPLIERS: Record<string, number> = { double: 2, triple: 3 };

function normalize(input: string): string {
  let t = input.normalize("NFKC");
  // zero-width and invisible characters
  t = t.replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "");
  // Arabic-Indic and Devanagari digits
  t = t.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  t = t.replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  t = t.replace(/[\u0966-\u096F]/g, (c) => String(c.charCodeAt(0) - 0x0966));
  return t.toLowerCase();
}

/** Removes prices so "35,000 20,000" is not mistaken for one long number. */
function stripMoney(t: string): string {
  return t
    // naira with a symbol or code: ₦35,000  n35000  ngn 35,000
    .replace(/(?:\u20A6|ngn|naira|\bn(?=\d))\s*\d[\d,]*(?:\.\d+)?\s*(?:k|m)?\b/g, " ")
    // properly grouped thousands: 35,000 or 1,250,000
    .replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, " ");
}

function hasPhoneNumber(t: string): boolean {
  const cleaned = stripMoney(t);

  // 1. Plain digits with common separators: 0803 123 4567, +234 (803) 123-4567.
  // Groups of digits are only joined by spaces, dots, dashes, brackets and
  // slashes (not commas), and only when they look like a phone number, so
  // "15000 20000 35000" (prices) is not treated as one long number.
  const spaced = cleaned.replace(/\bo(?=\d)|(?<=\d)o(?=\d|\b)/g, "0"); // o8o3 style
  const runs = spaced.match(/\d+(?:[\s.\-()/_*]+\d+)*/g) ?? [];
  for (const run of runs) {
    const groups = run.split(/\D+/).filter(Boolean);
    const joined = groups.join("");
    if (groups.some((g) => g.length >= 9)) return true;
    if (/(?:234|0)[789][01]\d{8}/.test(joined)) return true;
    if (joined.length >= 10 && groups.every((g) => g.length <= 4)) return true;
  }

  // 2. Spelled-out or mixed numbers: "zero eight zero three one two three ..."
  const tokens = cleaned.split(/[^a-z0-9+]+/).filter(Boolean);
  let digits = 0;
  let sawWord = false;
  let sawStrong = false;
  let pendingMultiplier = 1;

  const flush = () => {
    const hit = digits >= 8 && sawWord && sawStrong;
    digits = 0;
    sawWord = false;
    sawStrong = false;
    pendingMultiplier = 1;
    return hit;
  };

  for (const tok of tokens) {
    if (MULTIPLIERS[tok]) {
      pendingMultiplier = MULTIPLIERS[tok];
      continue;
    }
    const word = NUMBER_WORDS[tok];
    if (word !== undefined) {
      digits += pendingMultiplier;
      pendingMultiplier = 1;
      sawWord = true;
      if (!WEAK_WORDS.has(tok)) sawStrong = true;
      continue;
    }
    if (/^\+?\d+$/.test(tok)) {
      digits += tok.replace(/\D/g, "").length * pendingMultiplier;
      pendingMultiplier = 1;
      continue;
    }
    if (flush()) return true;
  }
  return flush();
}

const EMAIL_DOMAINS = /\b(gmail|g\s?mail|yahoo|ymail|hotmail|outlook|icloud|proton\s?mail|aol)\b/;

function hasEmail(t: string): boolean {
  if (t.includes("@")) return true;
  if (/[(\[{<]\s*at\s*[)\]}>]/.test(t)) return true;
  if (/[(\[{<]\s*dot\s*[)\]}>]/.test(t)) return true;
  if (EMAIL_DOMAINS.test(t)) return true;
  // "john at company dot com"
  if (/\bat\b.{1,40}\bdot\s+(com|net|org|ng|co|io)\b/.test(t)) return true;
  return false;
}

const TLD = "com|net|org|ng|co|io|me|app|info|biz|xyz|link|ly|gl|tv";

function hasLink(t: string): boolean {
  if (/(https?:\/\/|www\.|ftp:\/\/)/.test(t)) return true;
  if (new RegExp(`[a-z0-9-]\\.(${TLD})\\b`).test(t)) return true;
  if (new RegExp(`\\bdot\\s+(${TLD})\\b`).test(t)) return true;
  if (/\b(wa\.me|t\.me|bit\.ly|tinyurl|linktr\.ee)\b/.test(t)) return true;
  return false;
}

const SOCIAL =
  /\b(whats\s?-?app|watsap|whatsap|wa\s+me|telegram|signal\s+app|instagram|insta|facebook|snap\s?chat|tik\s?tok|twitter|messenger|imo\s+app|viber)\b/;

const OUTSIDE_CONTACT = [
  /\b(call|ring|phone|text|sms|dm|inbox|message|msg|ping|whatsapp)\s+(me|us|you|him|her|them)\b/,
  /\b(hit|holla|reach|contact|find)\s+(me|us)\s+(up|on|at|outside|directly|offline)\b/,
  /\b(my|your|his|her|our|their)\s+(phone\s+|mobile\s+|contact\s+|cell\s+|personal\s+|whatsapp\s+)?(number|no\.?|line|contact)\b/,
  /\b(phone|mobile|contact|cell|whatsapp)\s+(number|no\.?)\b/,
  /\b(outside|off)\s+(the\s+)?(app|crafteey|platform|chat)\b/,
  /\bleave\s+(the\s+)?(app|platform|crafteey)\b/,
  /\bgive\s+me\s+(a\s+)?call\b/,
  /\bdirect(ly)?\s+(contact|call|number)\b/,
];

const PAYMENT_OUTSIDE = [
  /\b(account|acct|acc)\s*(number|no\.?|details|name)\b/,
  /\b(opay|palmpay|moniepoint|kuda|paga|gtbank|gtb|zenith|first\s?bank|access\s?bank|uba|wema|sterling)\b/,
  /\b(pay|send|transfer|deposit)\s+(me|us|it|the\s+money|the\s+cash)?\s*(directly|cash|outside|offline|to\s+my)\b/,
  /\b(cash\s+(payment|only)|pay\s+cash|bank\s+transfer|pay\s+me\s+direct)\b/,
];

/** Checks one message. Safe to call on every send. */
export function checkMessage(text: string): LockResult {
  if (!text || !text.trim()) return { blocked: false };
  const t = normalize(text);

  if (hasEmail(t)) return { blocked: true, reason: "email" };
  if (hasLink(t)) return { blocked: true, reason: "link" };
  if (hasPhoneNumber(t)) return { blocked: true, reason: "phone" };
  if (SOCIAL.test(t)) return { blocked: true, reason: "social" };
  if (OUTSIDE_CONTACT.some((r) => r.test(t))) return { blocked: true, reason: "outside_contact" };
  if (PAYMENT_OUTSIDE.some((r) => r.test(t))) return { blocked: true, reason: "payment_outside" };

  return { blocked: false };
}