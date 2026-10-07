// Plain-English explanation shown to the sender when the contact lock blocks a message.

export type BlockedNotice = { title: string; body: string };

const NOTICES: Record<string, BlockedNotice> = {
  phone: {
    title: "Phone numbers can't be shared in chat.",
    body: "Talk about the job here in Crafteey chat. Agree the details and price with a quotation.",
  },
  email: {
    title: "Email addresses can't be shared in chat.",
    body: "Keep the conversation inside Crafteey so both sides stay protected.",
  },
  link: {
    title: "Links can't be sent in chat.",
    body: "Describe what you want to share in words instead.",
  },
  social: {
    title: "Other apps can't be used to reach each other.",
    body: "WhatsApp, Telegram, Instagram and similar apps are not allowed. Keep chatting here.",
  },
  outside_contact: {
    title: "Asking to talk outside Crafteey isn't allowed.",
    body: "Calls, DMs and meeting off the app remove your protection. Keep everything in this chat.",
  },
  payment_outside: {
    title: "Payments must stay inside Crafteey.",
    body: "Pay and get paid through the quotation card. That keeps the money protected for both sides.",
  },
};

const FALLBACK: BlockedNotice = {
  title: "This message breaks the Crafteey chat rules.",
  body: "Keep contact details, links and payments inside Crafteey.",
};

export function blockedNotice(reason?: string | null): BlockedNotice {
  return (reason && NOTICES[reason]) || FALLBACK;
}