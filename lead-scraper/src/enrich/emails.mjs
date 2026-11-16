// Optional email verification through MillionVerifier (set MILLIONVERIFIER_API_KEY).
// Only addresses the company published on its own site are checked; nothing is guessed.
import { getJson } from '../http.mjs';

export async function verifyEmails(emails) {
  const key = process.env.MILLIONVERIFIER_API_KEY;
  if (!key) return emails.map((e) => ({ ...e, verified: null }));
  const out = [];
  for (const e of emails) {
    const r = await getJson(
      `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(e.email)}&timeout=10`,
      { useCache: true },
    );
    out.push({ ...e, verified: r?.result || 'error' }); // ok | catch_all | unknown | invalid | disposable
  }
  return out;
}
