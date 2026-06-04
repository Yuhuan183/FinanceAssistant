/**
 * Taiwan ETF holdings (穿透成分) integration.
 *
 * Each issuer publishes 持股 differently:
 *   - 元大 (Yuanta): yuantaetfs.com   — used for 0050 / 00631L
 *   - 富邦 (Fubon): websys.fsit.com.tw — 0052
 *   - 國泰 (Cathay): cathaysite.com.tw — 00663L (futures-based, see note)
 *   - 統一 (Capital): capitalfund.com.tw — 00981A
 *
 * Leveraged futures-based ETFs (00631L, 00663L) hold a mix of index futures
 * + spot constituents. For exposure analysis, the relevant "look-through" is
 * the underlying *index* composition, not the fund's literal holdings.
 *   00631L → 台灣50 指數 → same composition as 0050
 *   00663L → 加權指數    → 加權 top weights
 *
 * Fetch is best-effort; if the live page changes shape, we fall back to a
 * cached snapshot (and clearly label it). The cache is hand-curated public
 * info — refresh it periodically.
 */
import * as cheerio from 'cheerio';
import { getText, num, round } from './_util.mjs';

/* ---------------- cached fallback snapshots (公開資料近似值) ---------------- */

const CACHE = {
  '0050': {
    label: '元大台灣50',
    index_tracked: '台灣50指數',
    tsmc_weight_pct: 60.0,
    top_holdings: [
      { symbol: '2330', name: '台積電', weight_pct: 60.0 },
      { symbol: '2308', name: '台達電', weight_pct: 4.9 },
      { symbol: '2317', name: '鴻海', weight_pct: 4.5 },
      { symbol: '2454', name: '聯發科', weight_pct: 3.5 },
      { symbol: '3711', name: '日月光投控', weight_pct: 2.5 },
    ],
    note: 'cached snapshot — top-10 holdings ≈ 80%+ of fund weight',
  },
  '0052': {
    label: '富邦科技',
    index_tracked: '台灣資訊科技指數',
    tsmc_weight_pct: 70.0,
    top_holdings: [
      { symbol: '2330', name: '台積電', weight_pct: 70.0 },
      { symbol: '2454', name: '聯發科', weight_pct: 5.0 },
      { symbol: '2317', name: '鴻海', weight_pct: 4.5 },
      { symbol: '2308', name: '台達電', weight_pct: 3.5 },
    ],
    note: 'cached snapshot — 科技類股集中,有「小台積」之稱',
  },
  '00631L': {
    label: '元大台灣50正2',
    index_tracked: '台灣50指數(單日正向2倍)',
    tsmc_weight_pct: 60.0,
    top_holdings: [
      { symbol: 'TX_futures', name: '台股期貨', weight_pct: null, note: '槓桿曝險主要來源' },
      { symbol: '2330', name: '台積電 現股', weight_pct: null, note: '部分現股,管理期貨部位上限' },
    ],
    note: 'cached snapshot — 2x daily 槓桿;穿透曝險視為 2× 台灣50 指數成分,TSMC 權重以底層指數計',
  },
  '00663L': {
    label: '國泰臺灣加權正2',
    index_tracked: '加權指數(單日正向2倍)',
    tsmc_weight_pct: 40.0,
    top_holdings: [
      { symbol: 'TX_futures', name: '台指期貨', weight_pct: null, note: '槓桿曝險主要來源' },
    ],
    note: 'cached snapshot — 2x daily 槓桿;穿透曝險視為 2× 加權指數,TSMC 在加權 ~40%',
  },
  '00981A': {
    label: '主動統一台股增長',
    index_tracked: '主動式（無追蹤指數）· 大型成長股',
    tsmc_weight_pct: 10.0,
    top_holdings: [
      { symbol: '2330', name: '台積電', weight_pct: 9.9 },
      { symbol: '2383', name: '台光電', weight_pct: 8.5 },
      { symbol: '2345', name: '智邦', weight_pct: 5.9 },
      { symbol: '2454', name: '聯發科', weight_pct: 5.8 },
      { symbol: '2308', name: '台達電', weight_pct: 5.1 },
      { symbol: '6669', name: '緯穎', weight_pct: 4.8 },
    ],
    note: 'cached snapshot — 主動式 ETF,實際另持有 0050/0052 用於突破單一持股 10% 法規上限,故真實 TSMC 穿透略高於 9.9%',
  },
};

/* ---------------- live fetchers (best-effort) ---------------- */

async function fetchYuanta(code) {
  // 元大投信 ETF 持股比重頁面,部分透過內嵌 JSON 取得。實作為 best-effort 嘗試。
  const url = `https://www.yuantaetfs.com/product/detail/${code}/ratio`;
  try {
    const html = await getText(url);
    const $ = cheerio.load(html);
    const rows = [];
    $('table tr').each((_, tr) => {
      const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
      if (cells.length >= 3) {
        const name = cells[1] || cells[0];
        const w = num((cells[2] || '').replace('%', ''));
        if (name && w !== null) rows.push({ name, weight_pct: round(w, 3) });
      }
    });
    if (!rows.length) return null;
    const tsmcRow = rows.find((r) => /台積電|2330/i.test(r.name));
    return {
      top_holdings: rows.slice(0, 10),
      tsmc_weight_pct: tsmcRow?.weight_pct ?? null,
      source_url: url,
    };
  } catch {
    return null;
  }
}

/* ---------------- public API ---------------- */

export async function holdings(code) {
  const upper = code.toUpperCase();
  const cached = CACHE[upper];
  if (!cached) {
    return { code: upper, error: `unknown ETF code; supported: ${Object.keys(CACHE).join(', ')}` };
  }

  let live = null;
  if (upper === '0050' || upper === '00631L') {
    live = await fetchYuanta(upper).catch(() => null);
  }
  // additional live fetchers for 0052 / 00663L / 00981A可以後續加入

  return {
    code: upper,
    label: cached.label,
    index_tracked: cached.index_tracked,
    tsmc_weight_pct: live?.tsmc_weight_pct ?? cached.tsmc_weight_pct,
    top_holdings: live?.top_holdings ?? cached.top_holdings,
    note: cached.note,
    fetched_at: new Date().toISOString(),
    source: live ? `live: ${live.source_url}` : 'cached snapshot (公開資料近似值)',
    is_live: !!live,
  };
}

/** Look-through aggregator: given the user's portfolio weights, compute TSMC pass-through exposure. */
export async function lookThroughTsmc(weightsByCode) {
  // weightsByCode = { '0050': 20.2, '0052': 11.0, ..., '2330': 15.3 }
  const out = { contributions: [], total_nominal_exposure_pct: 0, tsmc_lookthrough_pct: 0 };
  for (const [code, weight] of Object.entries(weightsByCode)) {
    if (code === '2330') {
      out.contributions.push({ code, weight_pct: weight, tsmc_share: 100, contribution: weight });
      out.total_nominal_exposure_pct += weight;
      out.tsmc_lookthrough_pct += weight;
      continue;
    }
    const h = await holdings(code).catch(() => null);
    if (!h || h.error) continue;
    const isLev = /(00631L|00663L)/i.test(code);
    const exposure = isLev ? weight * 2 : weight;
    const tsmcShare = h.tsmc_weight_pct ?? 0;
    const contribution = round(exposure * tsmcShare / 100, 3);
    out.contributions.push({
      code,
      label: h.label,
      weight_pct: weight,
      leverage: isLev ? 2 : 1,
      nominal_exposure_pct: round(exposure, 3),
      tsmc_share_pct: tsmcShare,
      contribution_pct: contribution,
    });
    out.total_nominal_exposure_pct += exposure;
    out.tsmc_lookthrough_pct += contribution;
  }
  out.total_nominal_exposure_pct = round(out.total_nominal_exposure_pct, 2);
  out.tsmc_lookthrough_pct = round(out.tsmc_lookthrough_pct, 2);
  out.tsmc_share_of_total_exposure_pct = round(
    (out.tsmc_lookthrough_pct / out.total_nominal_exposure_pct) * 100,
    2,
  );
  out.leverage_ratio = round(out.total_nominal_exposure_pct / 100, 3);
  return out;
}
