/**
 * Shared utilities: HTTP fetch with UA & timeout, CSV parsing, date helpers.
 */
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const UA = process.env.USER_AGENT || DEFAULT_UA;
const TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

/** Fetch a URL with timeout + UA. Returns the Response object. */
export async function httpGet(url, { headers = {}, timeoutMs = TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** GET JSON. Throws on non-OK or non-JSON. */
export async function getJson(url, opts) {
  const res = await httpGet(url, opts);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

/** GET text. Throws on non-OK. */
export async function getText(url, opts) {
  const res = await httpGet(url, opts);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

/** Parse a CSV string into array of objects (keyed by header row). */
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = splitCsvLine(line);
    const o = {};
    headers.forEach((h, i) => (o[h] = fields[i] ?? ''));
    return o;
  });
}

function splitCsvLine(line) {
  // simple CSV split honoring quoted fields
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Format a Date or YYYY-MM-DD string as YYYYMMDD (TWSE convention). */
export function ymd(d) {
  if (typeof d === 'string') return d.replace(/-/g, '').slice(0, 8);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Format a Date or YYYY-MM-DD string as YYYY-MM-DD. */
export function isoDate(d) {
  if (typeof d === 'string') {
    if (d.includes('-')) return d.slice(0, 10);
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse "1,234.56" or "1234.56" or "--" → number or null. */
export function num(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const cleaned = String(s).replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '--' || cleaned === 'N/A' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Round to N decimal places. */
export function round(x, n = 4) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** n;
  return Math.round(x * f) / f;
}

/** Wrap a value (or error) into an MCP tool result. */
export function ok(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function err(message, extra = {}) {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }],
  };
}
