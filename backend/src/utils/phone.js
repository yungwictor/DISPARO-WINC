const repeatedDigit = /^(\d)\1{7,}$/;

export function normalizePhone(input = "") {
  const raw = String(input).trim();
  const prefixed = raw.startsWith("+") ? `+${raw.slice(1).replace(/\D/g, "")}` : raw.replace(/\D/g, "");
  return prefixed.startsWith("+") ? prefixed : `+${prefixed}`;
}

export function isLikelyValidWhatsApp(input = "") {
  const phone = normalizePhone(input);
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) return false;
  if (repeatedDigit.test(digits)) return false;
  if (/^0+$/.test(digits)) return false;

  return true;
}

export function dedupeRecipients(recipients) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  const duplicates = [];

  for (const recipient of recipients) {
    const phone = normalizePhone(recipient.phone || recipient.numero || recipient.telefone || "");
    const hydrated = { ...recipient, phone };

    if (!isLikelyValidWhatsApp(phone)) {
      invalid.push(hydrated);
      continue;
    }

    if (seen.has(phone)) {
      duplicates.push(hydrated);
      continue;
    }

    seen.add(phone);
    valid.push(hydrated);
  }

  return { valid, invalid, duplicates };
}

export function parseRecipientsFromText(text = "") {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phone, name = "", field1 = "", field2 = "", vencimento = "", plano = ""] = line
        .split(/[;,]/)
        .map((part) => part.trim());

      return { phone, name, field1, field2, vencimento, plano };
    });
}
