/**
 * Czech "go off-platform / pay before viewing" phrasing — the textual half of
 * the scam signal. Matched diacritic-insensitively against the normalized
 * description. Tuned conservatively: a hit is one input to a weighted score,
 * never a verdict on its own.
 */
const RED_PHRASES: Array<{ test: RegExp; label: string }> = [
  {
    test: /zaloh\w* predem|platb\w* predem|kauc\w* predem|penize predem/,
    label: "Asks for a deposit/payment before viewing",
  },
  {
    test: /v zahranici|ze zahranici|do zahranici|zahranicni/,
    label: "Owner / payment abroad",
  },
  {
    test: /western union|moneygram/,
    label: "Mentions Western Union / MoneyGram",
  },
  {
    test: /pouze (e-?mail|pres e-?mail)|kontaktujte (me )?pouze/,
    label: "Email-only contact, pushes off-platform",
  },
  { test: /whatsapp/, label: "Pushes contact to WhatsApp" },
  {
    test: /bez prohlidky|nelze prohlidnout|nelze prohlednout/,
    label: "Discourages an in-person viewing",
  },
];

/** Lowercase + strip diacritics so "zálohu předem" matches "zaloh predem". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function detectRedPhrase(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const normalized = normalize(description);
  for (const phrase of RED_PHRASES) {
    if (phrase.test.test(normalized)) return phrase.label;
  }
  return null;
}
