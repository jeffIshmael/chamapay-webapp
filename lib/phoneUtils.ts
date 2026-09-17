/** Normalize Kenyan phone input to local 9-digit form (without 0/254). */
export function normalizeKenyaPhoneLocal(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = p.slice(1);
  if (p.startsWith("254")) p = p.slice(3);
  return p;
}

export function toKenyaE164(phone: string): string {
  return `254${normalizeKenyaPhoneLocal(phone)}`;
}

export function isValidKenyaPhone(phone: string): boolean {
  const local = normalizeKenyaPhoneLocal(phone);
  return /^[17]\d{8}$/.test(local);
}

export function formatPhoneDisplay(phone: string): string {
  const local = normalizeKenyaPhoneLocal(phone);
  if (local.length !== 9) return phone;
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
