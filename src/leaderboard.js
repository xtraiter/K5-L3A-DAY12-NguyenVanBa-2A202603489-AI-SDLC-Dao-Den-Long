// Local leaderboard (Ticket-04 §3): pure logic shared by the web client, the local server and the export command.
export const MAX_ENTRIES = 10;
// 3–12 chars of [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted (bonus).
const NAME_RE = /^[A-Za-z0-9_À-ɏḀ-ỿ]{3,12}$/u;

export function validName(name) {
  return typeof name === 'string' && NAME_RE.test(name.normalize('NFC'));
}

/** ISO 8601 with the local time-zone offset, e.g. 2026-11-20T16:05:09+07:00 */
export function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

export function makeEntry({ name, score, nights_won, seed, at = new Date() }) {
  if (!validName(name)) throw new Error('Tên phải dài 3–12 ký tự: chữ, số hoặc _');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be an integer >= 0');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0..3');
  return { name: name.normalize('NFC'), score, nights_won, achieved_at: isoWithOffset(at), seed };
}

/** score desc; equal score -> earlier achievement first; keep top 10 */
export function sortEntries(entries) {
  return [...entries]
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, MAX_ENTRIES);
}

export function addEntry(entries, entry) {
  return sortEntries([...(entries || []), entry]);
}
