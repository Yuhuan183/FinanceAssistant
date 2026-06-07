/**
 * FRED (Federal Reserve Economic Data) integration.
 *
 * 兩條路徑:
 *   1) 官方 API(穩定,建議):若設了 FRED_API_KEY 環境變數,走
 *      https://api.stlouisfed.org/fred/series/observations (JSON)。
 *      免費 key 申請:https://fredaccount.stlouisfed.org/apikeys
 *   2) 無 key 退路:走免認證 CSV 端點 fred.stlouisfed.org/graph/fredgraph.csv
 *      (近期該端點對部分網路常逾時,故官方 API 為首選)。
 *
 * Common series IDs:
 *   DGS10 / DGS2 / DFF / T10Y2Y / DCOILWTICO / DCOILBRENTEU / DTWEXBGS
 *   T5YIE / T10YIE / UNRATE / CPIAUCSL / GDPC1
 */
import { getJson, getText, parseCsv, num, round, isoDate } from './_util.mjs';

const API = 'https://api.stlouisfed.org/fred/series/observations';
const CSV_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const fredKey = () => process.env.FRED_API_KEY || '';

/**
 * Fetch a FRED series. Returns latest N observations.
 * 有 key → 官方 API;失敗或無 key → CSV 退路。
 */
export async function series(seriesId, days = 60) {
  if (fredKey()) {
    try {
      const r = await seriesViaApi(seriesId, days);
      if (!r.error) return r;
    } catch (e) {
      // 官方 API 失敗則退回 CSV
    }
  }
  return seriesViaCsv(seriesId, days);
}

async function seriesViaApi(seriesId, days) {
  const limit = Math.max(days || 1, 1);
  const url =
    `${API}?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${fredKey()}&file_type=json&sort_order=desc&limit=${limit}`;
  const j = await getJson(url);
  const obs = (j.observations || [])
    .map((o) => ({ date: o.date, value: num(o.value) }))
    .filter((o) => o.value !== null)
    .reverse(); // 轉回時間正序
  if (!obs.length) return { series_id: seriesId, error: 'no data (FRED API)' };
  const latest = obs[obs.length - 1];
  const first = obs[0];
  return {
    series_id: seriesId,
    days: obs.length,
    latest: { date: latest.date, value: round(latest.value, 4) },
    period_start: { date: first.date, value: round(first.value, 4) },
    change_over_period: round(latest.value - first.value, 4),
    observations: obs.map((o) => ({ date: o.date, value: round(o.value, 4) })),
    source: 'FRED official API (api.stlouisfed.org)',
  };
}

async function seriesViaCsv(seriesId, days) {
  const url = `${CSV_BASE}?id=${encodeURIComponent(seriesId)}`;
  const csv = await getText(url, { headers: { Accept: 'text/csv' } });
  const rows = parseCsv(csv);
  if (!rows.length) return { series_id: seriesId, error: 'no data (CSV)' };
  const valKey = Object.keys(rows[0]).find((k) => k !== 'observation_date' && k !== 'DATE');
  const dateKey = 'observation_date' in rows[0] ? 'observation_date' : 'DATE';
  const obs = rows
    .map((r) => ({ date: isoDate(r[dateKey]), value: num(r[valKey]) }))
    .filter((r) => r.value !== null);
  const tail = days ? obs.slice(-days) : obs;
  const latest = tail[tail.length - 1];
  const first = tail[0];
  return {
    series_id: seriesId,
    days: tail.length,
    latest: latest ? { date: latest.date, value: round(latest.value, 4) } : null,
    period_start: first ? { date: first.date, value: round(first.value, 4) } : null,
    change_over_period: latest && first ? round(latest.value - first.value, 4) : null,
    observations: tail.map((o) => ({ date: o.date, value: round(o.value, 4) })),
    source: fredKey()
      ? 'FRED CSV fallback (官方 API 失敗)'
      : 'FRED CSV (未設 FRED_API_KEY;建議申請免費 key 改用官方 API)',
  };
}

/** Fetch multiple series; returns array. */
export async function multi(seriesIds, days = 60) {
  return Promise.all(
    seriesIds.map((id) =>
      series(id, days).catch((e) => ({ series_id: id, error: e.message })),
    ),
  );
}

/** Quick dashboard of common macro indicators. */
export async function macroDashboard() {
  return multi(['DGS10', 'DGS2', 'T10Y2Y', 'DFF', 'DCOILWTICO', 'DTWEXBGS', 'T10YIE'], 30);
}

/** 是否已設定官方 API key(供 health check 顯示模式). */
export function usingApi() {
  return !!fredKey();
}
