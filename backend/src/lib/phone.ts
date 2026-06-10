/** True if a US E.164 number can be dialed (rejects 555 area code, fiction lines, etc.). */
export function isDialableUsE164(e164: string): boolean {
  const m = e164.match(/^\+1(\d{10})$/);
  if (!m) return false;
  return isValidUsNational(m[1]!);
}

/** True if E.164 is dialable for outbound voice (US NANP rules or international). */
export function isDialableE164(e164: string): boolean {
  if (e164.startsWith("+1")) return isDialableUsE164(e164);
  return /^\+\d{8,15}$/.test(e164);
}

function isValidUsNational(national: string): boolean {
  if (national.length !== 10) return false;

  const area = national.slice(0, 3);
  const exchange = national.slice(3, 6);

  if (area[0]! < "2" || exchange[0]! < "2") return false;
  if (area === "555" || exchange === "555") return false;

  return true;
}

/** Normalize a pharmacy phone string to E.164 (US default when 10 digits). */
export function normalizePhoneToE164(phone: string): string | null {
  let raw = phone.trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith("tel:")) raw = raw.slice(4).trim();
  raw = raw.split(/[,;]|(?:\s+or\s+)/i)[0]!.trim();
  raw = raw.replace(/\s*(?:ext\.?|x|extension|#)\s*.*/i, "").trim();
  if (!raw) return null;

  const hadPlus = raw.startsWith("+");
  const digits = (hadPlus ? raw.slice(1) : raw).replace(/\D/g, "");
  if (!digits) return null;

  const usNational = extractUsNationalDigits(digits);
  if (usNational) {
    const e164 = `+1${usNational}`;
    return isValidUsNational(usNational) ? e164 : null;
  }

  if (hadPlus && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

function extractUsNationalDigits(digits: string): string | null {
  if (digits.length === 10) return digits;

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  if (digits.length > 11 && digits.startsWith("1")) {
    let d = digits;
    while (d.length > 11 && d.startsWith("1")) d = d.slice(1);
    if (d.length === 11 && d.startsWith("1")) return d.slice(1);
    if (d.length === 10) return d;
  }

  return null;
}

export function parsePharmacyPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return normalizePhoneToE164(raw);
}
