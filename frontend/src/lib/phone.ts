/** True if the number can be used for outbound voice (US NANP rules). */
export function isDialableForVoice(phone: string): boolean {
  const us = phone.match(/^\+1(\d{10})$/);
  if (!us) return /^\+\d{8,15}$/.test(phone);

  const national = us[1]!;
  const area = national.slice(0, 3);
  const exchange = national.slice(3, 6);
  if (area[0]! < "2" || exchange[0]! < "2") return false;
  if (area === "555" || exchange === "555") return false;
  return true;
}

/** Format E.164 for display; pass through already-friendly strings. */
export function formatPhoneForDisplay(phone: string): string {
  const us = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `(${us[1]}) ${us[2]}-${us[3]}`;

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

/** tel: href with country code when possible. */
export function phoneTelHref(phone: string): string {
  const e164 = phone.match(/^\+\d{8,15}$/)
    ? phone
    : (() => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
        return phone;
      })();
  return `tel:${e164}`;
}
