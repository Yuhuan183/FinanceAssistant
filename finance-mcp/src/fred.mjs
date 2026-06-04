/**
 * FRED (Federal Reserve Economic Data) integration.
 * Uses the no-auth CSV endpoint at fred.stlouisfed.org/graph/fredgraph.csv
 *
 * Common series IDs:
 *   DGS10  — 10y US Treasury yield
 *   DGS2   — 2y US Treasury yield
 *   DFF    — Effective Fed Funds Rate
 *   T10Y2Y — 10y minus 2y spread
 *   DCOILWTICO — WTI crude
 *   DCOILBRENTEU — Brent crude
 *   DTWEXBGS — Broad USD index (Nominal, Daily)
 *   T5YIE   — 5-year inflation breakeven
 *   T10YIE  — 10-year inflation breakeven
 *   UNRATE  — US unemployment rate
 *   CPIAUCSL — US CPI All Items
 *   GDPC1   — US Real GDP
 */
import { getText, parseCsv, num, round, isoDate } from './_util.mjs';

const BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

/**
 * Fetch a FRED series. Returns latest N observations.
 * If days is null/undefined, return all available.
 */
export async function series(seriesId, days = 60) {
  const url = `${BASE}?id=${encodeURIComponent(seriesId)}`;
  const csv = await getText(url, { headers: { Accept: 'text/csv' } });
  const rows = parseCsv(csv);
  if (!rows.length) return { series_id: seriesId, error: 'no data' };
  // expected columns: observation_date, <SERIES_ID>
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
    source: 'FRED (fredgraph.csv)',
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
