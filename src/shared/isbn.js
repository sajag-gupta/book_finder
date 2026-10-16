/** Strip spaces and hyphens and upper-case, so "978-0-441-01359-3" and "9780441013593" compare equal. */
export function normalizeIsbn(input) {
  return String(input ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

/** True when `value` is a well-formed ISBN-13 with a correct check digit. */
export function isValidIsbn13(value) {
  const s = normalizeIsbn(value);
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}
