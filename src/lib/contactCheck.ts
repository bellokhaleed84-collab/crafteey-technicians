import { checkMessage } from "@/lib/contactLock";

export const CONTACT_INFO_MESSAGE =
  "This can't include phone numbers, emails or links. Customers contact you through Crafteey chat.";

/** For public profile text. Uses the full contact lock, minus the payment rule. */
export function containsContactInfo(text: string): boolean {
  const result = checkMessage(text);
  return result.blocked && result.reason !== "payment_outside";
}