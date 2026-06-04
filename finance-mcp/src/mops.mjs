/**
 * Monthly revenue — Taiwan listed company.
 *
 * 改用 TWSE OpenAPI(`openapi.twse.com.tw`)的 JSON 端點。比 MOPS 的靜態 HTML
 * 穩定:單一 endpoint 回所有上市/上櫃公司「最新」月份的營收;我們以股票代號
 * 過濾。MOPS 舊版 HTML(t21sc03_*.html)已大量 404。
 *
 *   - 上市: https://openapi.twse.com.tw/v1/opendata/t187ap05_L
 *   - 上櫃: https://openapi.tpex.org.tw/v1/opendata/t187ap05_O  (域名不同)
 *
 * 注意:OpenAPI 只回「最新一期」的月營收(目前公布的最新月份),要查歷史月份
 * 需自行緩存或改 fetch MOPS POST 端點(較複雜)。
 */
import { getJson, num, round } from './_util.mjs';

/**
 * Get monthly revenue for a single stock for a given year/month.
 * Returns { stock, year, month, revenue, yoy_pct, ... } or { error }.
 */
const SII_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L';
// 上櫃 OpenAPI 在 tpex(櫃買中心),路徑略不同;優先試 sii。
const OTC_URL = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O';

/** 從 OpenAPI 取得所有上市/上櫃公司的最新月營收 array (含快取在記憶體 5 分鐘) */
let CACHE = { ts: 0, sii: null, otc: null };
const TTL_MS = 5 * 60 * 1000;

async function loadAll() {
  const now = Date.now();
  if (now - CACHE.ts < TTL_MS && CACHE.sii) return CACHE;
  const [sii, otc] = await Promise.all([
    getJson(SII_URL).catch(() => null),
    getJson(OTC_URL).catch(() => null),
  ]);
  CACHE = { ts: now, sii, otc };
  return CACHE;
}

function findRow(list, stockCode) {
  if (!Array.isArray(list)) return null;
  return list.find((r) => r['公司代號'] === String(stockCode) || r.Code === String(stockCode)) || null;
}

/**
 * 取得個股「最新一期」月營收(OpenAPI 不提供任意月份歷史,僅最新)。
 * 若 caller 傳的 year/month 與最新一期不同,會在回傳中註明。
 */
export async function monthlyRevenue(stockCode, year, month) {
  if (!stockCode) return { error: 'stockCode required' };
  try {
    const { sii, otc } = await loadAll();
    const siiHit = findRow(sii, stockCode);
    const otcHit = findRow(otc, stockCode);
    const hit = siiHit || otcHit;
    const market = siiHit ? 'sii' : otcHit ? 'otc' : null;
    if (!hit) {
      return {
        stock: stockCode,
        error: 'stock not found in OpenAPI latest monthly revenue (上市+上櫃 都沒有)',
      };
    }
    // 欄位名稱在上市/上櫃略有差異,做雙重 mapping
    const get = (k1, k2) => hit[k1] ?? hit[k2] ?? null;
    const reportedYear = num(get('資料年月', 'Report_Year_Month'));
    // 資料年月為 YYYMM 格式,YY 為民國年(ROC). 例:11504 → 民國 115 年 4 月 → AD 2026 年 4 月
    const yyRoc = reportedYear ? Math.floor(reportedYear / 100) : null;
    const yyAd = yyRoc ? yyRoc + 1911 : null;
    const mm = reportedYear ? reportedYear % 100 : null;
    const reqOk = (!year || !month) || (year === yyAd && Number(month) === mm);
    return {
      stock: stockCode,
      name: get('公司名稱', 'Name'),
      year: yyAd,         // AD 西元年(已自動由 ROC 民國 +1911 轉換)
      month: mm,
      year_roc: yyRoc,    // 保留民國年欄位,供需要原始格式者使用
      revenue: num(get('營業收入-當月營收', 'Revenue')),
      prev_month_revenue: num(get('營業收入-上月營收', 'LastMonthRevenue')),
      yoy_month_revenue: num(get('營業收入-去年當月營收', 'LastYearMonthRevenue')),
      mom_pct: num(get('營業收入-上月比較增減(%)', 'MoMPercent')),
      yoy_pct: num(get('營業收入-去年同月增減(%)', 'YoYPercent')),
      ytd_revenue: num(get('累計營業收入-當月累計營收', 'AccumulatedRevenue')),
      ytd_prev_year: num(get('累計營業收入-去年累計營收', 'LastYearAccumulatedRevenue')),
      ytd_yoy_pct: num(get('累計營業收入-前期比較增減(%)', 'AccumulatedYoYPercent')),
      currency: 'TWD (thousands)',
      market,
      note: reqOk ? null : `OpenAPI 僅提供最新一期(AD ${yyAd}/${mm} = 民國 ${yyRoc}/${mm});你查詢的 ${year}/${month} 與最新期不同`,
      source: market === 'sii' ? SII_URL : OTC_URL,
    };
  } catch (e) {
    return { stock: stockCode, error: `fetch failed: ${e.message}` };
  }
}

/** Convenience: fetch monthly revenue for multiple AI supply chain stocks. */
export async function aiSupplyChainRevenue(year, month) {
  const stocks = ['2330', '2317', '2382', '6669', '2308'];
  // 台積電/鴻海/廣達/緯穎/台達電
  return Promise.all(stocks.map((s) => monthlyRevenue(s, year, month)));
}
