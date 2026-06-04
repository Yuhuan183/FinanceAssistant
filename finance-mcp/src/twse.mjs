/**
 * TWSE (台灣證券交易所) open data integration.
 *
 * Endpoints used (all public):
 *   - 三大法人買賣金額統計表 BFI82U
 *   - 個股日成交資訊 STOCK_DAY
 *   - 加權指數歷史 MI_5MINS_HIST
 *
 * TWSE returns Big5-flavored Chinese field names; we normalize to ASCII keys.
 */
import { getJson, ymd, isoDate, num, round } from './_util.mjs';

const BASE = 'https://www.twse.com.tw';

/* ---------------- 加權指數 ---------------- */

/**
 * 加權指數收盤 — get TWII close for a specific date (YYYY-MM-DD or YYYYMMDD).
 * Returns null if non-trading day.
 */
export async function taiex(date) {
  const dd = ymd(date);
  const monthFirst = dd.slice(0, 6) + '01';
  const url = `${BASE}/indicesReport/MI_5MINS_HIST?response=json&date=${monthFirst}`;
  const data = await getJson(url);
  const target = isoDate(date);
  const rows = (data.data || []).map((r) => ({
    // r[0] is date "115/05/22" (Minguo), r[1] open, r[2] high, r[3] low, r[4] close
    date: minguoToIso(r[0]),
    open: num(r[1]),
    high: num(r[2]),
    low: num(r[3]),
    close: num(r[4]),
  }));
  const hit = rows.find((r) => r.date === target);
  if (!hit) return { date: target, error: 'no data for this date (non-trading day or out of month range)' };
  const idx = rows.indexOf(hit);
  const prev = idx > 0 ? rows[idx - 1] : null;
  return {
    index: 'TWII (加權指數)',
    date: hit.date,
    open: hit.open,
    high: hit.high,
    low: hit.low,
    close: hit.close,
    prev_close: prev?.close ?? null,
    change: prev?.close ? round(hit.close - prev.close, 2) : null,
    change_pct: prev?.close ? round((hit.close / prev.close - 1) * 100, 3) : null,
    source: 'TWSE MI_5MINS_HIST',
  };
}

/* ---------------- 三大法人 ---------------- */

/**
 * 三大法人 — net buy/sell summary for a single trading day.
 * Returns object with foreign, trust, dealer (proprietary + hedge) breakdown plus total.
 */
export async function threeInstitutional(date) {
  const dd = ymd(date);
  const url = `${BASE}/rwd/zh/fund/BFI82U?dayDate=${dd}&type=day&response=json`;
  const data = await getJson(url);
  if (!data?.data?.length) return { date: isoDate(date), error: 'no data (non-trading day?)' };

  const out = {
    date: isoDate(date),
    by_category: {},
    total_net_amount: 0,
    source: 'TWSE BFI82U',
  };
  // each row: [category_name, buy_amount, sell_amount, net_amount]
  for (const row of data.data) {
    const cat = row[0]?.trim();
    const buy = num(row[1]);
    const sell = num(row[2]);
    const net = num(row[3]);
    const key = mapInstCategory(cat);
    out.by_category[key] = {
      label: cat,
      buy_amount: buy,
      sell_amount: sell,
      net_amount: net,
    };
    if (key !== 'total') out.total_net_amount += net || 0;
  }
  out.total_net_amount = round(out.total_net_amount, 0);
  return out;
}

function mapInstCategory(name) {
  if (!name) return 'unknown';
  if (name.includes('自營商') && name.includes('避險')) return 'dealer_hedge';
  if (name.includes('自營商')) return 'dealer_proprietary';
  if (name.includes('投信')) return 'investment_trust';
  if (name.includes('外資') || name.includes('陸資')) return 'foreign';
  if (name.includes('合計')) return 'total';
  return name;
}

/* ---------------- 個股日成交 ---------------- */

/**
 * 個股日成交資訊 — STOCK_DAY returns a whole month of daily bars for one stock.
 */
export async function stock(code, date) {
  const dd = ymd(date);
  const monthFirst = dd.slice(0, 6) + '01';
  const url = `${BASE}/exchangeReport/STOCK_DAY?response=json&date=${monthFirst}&stockNo=${code}`;
  const data = await getJson(url);
  if (data.stat !== 'OK' || !data.data?.length) {
    return { ticker: code, date: isoDate(date), error: data.stat || 'no data' };
  }
  const target = isoDate(date);
  const rows = data.data.map((r) => ({
    // r[0]=date YY/MM/DD Minguo, r[1]=volume, r[2]=turnover, r[3]=open, r[4]=high, r[5]=low, r[6]=close, r[7]=change, r[8]=trades
    date: minguoToIso(r[0]),
    volume: num(r[1]),
    turnover: num(r[2]),
    open: num(r[3]),
    high: num(r[4]),
    low: num(r[5]),
    close: num(r[6]),
    change: num(r[7]),
    trades: num(r[8]),
  }));
  const hit = rows.find((r) => r.date === target);
  if (!hit) return { ticker: code, date: target, error: 'no data for this date (non-trading day?)' };
  const idx = rows.indexOf(hit);
  const prev = idx > 0 ? rows[idx - 1] : null;
  return {
    ticker: code,
    name: data.title || null,
    date: hit.date,
    open: hit.open,
    high: hit.high,
    low: hit.low,
    close: hit.close,
    volume: hit.volume,
    change: hit.change,
    change_pct: prev?.close ? round((hit.close / prev.close - 1) * 100, 3) : null,
    prev_close: prev?.close ?? null,
    source: 'TWSE STOCK_DAY',
  };
}

/* ---------------- helpers ---------------- */

/** "115/05/22" → "2026-05-22" (Minguo Y+1911). */
function minguoToIso(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!m) return null;
  const y = Number(m[1]) + 1911;
  const mm = String(Number(m[2])).padStart(2, '0');
  const dd = String(Number(m[3])).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
