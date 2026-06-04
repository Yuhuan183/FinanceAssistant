/**
 * Yahoo Finance integration via yahoo-finance2.
 * Covers global indices, US equities, ETFs (incl. TW with .TW suffix),
 * FX, commodities.
 */
import yahooFinanceImport from 'yahoo-finance2';
import { round } from './_util.mjs';

/**
 * yahoo-finance2 不同版本的 default export 形狀差異很大:
 *   v2.13 之前: instance(物件,直接有 .quote 等方法)
 *   v2.13+   : 包成 {default: <instance>} 在某些 ESM 環境
 *   recent  : 變成 class constructor(function),需要 new 出 instance
 * 依序嘗試這幾種模式找到可用的 instance。
 */
function resolveYf(mod) {
  // (1) 已經是 instance — 直接有 .quote
  if (mod && typeof mod.quote === 'function') return mod;
  // (2) 包在 .default
  if (mod?.default && typeof mod.default.quote === 'function') return mod.default;
  if (mod?.default?.default && typeof mod.default.default.quote === 'function') return mod.default.default;
  // (3) 是 class constructor — 用 new
  if (typeof mod === 'function') {
    try {
      const inst = new mod();
      if (typeof inst.quote === 'function') return inst;
    } catch {}
  }
  if (typeof mod?.default === 'function') {
    try {
      const inst = new mod.default();
      if (typeof inst.quote === 'function') return inst;
    } catch {}
  }
  return null;
}

const yahooFinance = resolveYf(yahooFinanceImport);

if (!yahooFinance) {
  console.error(
    '[yfin] FATAL: 無法解析 yahoo-finance2 默認導出。' +
      `top typeof=${typeof yahooFinanceImport}; ` +
      `keys=[${Object.keys(yahooFinanceImport || {}).slice(0, 10).join(',')}]。` +
      '請執行 node scripts/diag-yf.mjs 查看實際形狀。',
  );
  // 不丟例外,讓其他模組仍可運作;呼叫 yfin.* 會回 error。
}

// suppress yahoo-finance2's deprecation notices for cleaner stdio
yahooFinance?.suppressNotices?.(['yahooSurvey']);

function ensureReady() {
  if (!yahooFinance) {
    throw new Error('yahoo-finance2 init failed; see stderr from diag-yf.mjs');
  }
}

export const PRESETS = {
  'us-indices': ['^GSPC', '^DJI', '^IXIC', '^SOX', '^VIX'],
  'us-portfolio': ['NVDA', 'AMD', 'GOOGL', 'QQQ', 'SMH', 'VOO', 'VT'],
  'tw-portfolio': ['0050.TW', '0052.TW', '00631L.TW', '00663L.TW', '00981A.TW', '2330.TW'],
  'tw-index': ['^TWII'],
  'macro': ['CL=F', 'GC=F', 'DX-Y.NYB', 'TWD=X', '^TNX', '^FVX'],
};

function pickQuoteFields(q) {
  if (!q) return null;
  return {
    ticker: q.symbol,
    name: q.shortName || q.longName || null,
    currency: q.currency || null,
    market_time: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : null,
    price: round(q.regularMarketPrice, 4),
    prev_close: round(q.regularMarketPreviousClose, 4),
    change: round(q.regularMarketChange, 4),
    change_pct: round(q.regularMarketChangePercent, 3),
    open: round(q.regularMarketOpen, 4),
    high: round(q.regularMarketDayHigh, 4),
    low: round(q.regularMarketDayLow, 4),
    volume: q.regularMarketVolume ?? null,
    fifty_two_week_high: round(q.fiftyTwoWeekHigh, 4),
    fifty_two_week_low: round(q.fiftyTwoWeekLow, 4),
    market_cap: q.marketCap ?? null,
    source: 'Yahoo Finance',
  };
}

/** Single-ticker quote. */
export async function quote(ticker) {
  ensureReady();
  const q = await yahooFinance.quote(ticker);
  return pickQuoteFields(q);
}

/** Batch quotes (multiple tickers). */
export async function quotes(tickers) {
  ensureReady();
  const results = await yahooFinance.quote(tickers);
  const arr = Array.isArray(results) ? results : [results];
  return arr.map(pickQuoteFields);
}

/** Resolve a preset name to a list of tickers, then quote all. */
export async function preset(name) {
  const list = PRESETS[name];
  if (!list) throw new Error(`unknown preset: ${name}. choices: ${Object.keys(PRESETS).join(', ')}`);
  return quotes(list);
}

/** Daily OHLCV history. days defaults to 30. */
export async function history(ticker, days = 30) {
  ensureReady();
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(days, 5) * 1.7 * 86400_000);
  // yahoo-finance2 v2.x 用 `historical`;v3+ 改名為 `chart`。
  const fn = typeof yahooFinance.historical === 'function'
    ? yahooFinance.historical.bind(yahooFinance)
    : typeof yahooFinance.chart === 'function'
      ? (sym, opts) =>
          yahooFinance.chart(sym, { ...opts, interval: opts.interval || '1d' })
            .then((r) => r?.quotes || r)
      : null;
  if (!fn) throw new Error('neither yahooFinance.historical nor .chart available');
  const rows = await fn(ticker, {
    period1: start,
    period2: end,
    interval: '1d',
  });
  const tail = rows.slice(-days);
  return {
    ticker,
    days: tail.length,
    history: tail.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      open: round(r.open, 4),
      high: round(r.high, 4),
      low: round(r.low, 4),
      close: round(r.close, 4),
      adj_close: round(r.adjClose, 4),
      volume: r.volume ?? null,
    })),
    source: 'Yahoo Finance',
  };
}

/** Compute annualized vol / max drawdown / cumulative return over recent N trading days. */
export async function stats(ticker, days = 252) {
  const h = await history(ticker, days);
  const closes = h.history.map((r) => r.close).filter((v) => v !== null);
  if (closes.length < 2) return { ticker, error: 'insufficient data' };
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const dailyVol = Math.sqrt(variance);
  const annVol = dailyVol * Math.sqrt(252);
  let peak = closes[0];
  let mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = c / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  return {
    ticker,
    days: closes.length,
    cum_return_pct: round((closes[closes.length - 1] / closes[0] - 1) * 100, 2),
    annualized_vol_pct: round(annVol * 100, 2),
    max_drawdown_pct: round(mdd * 100, 2),
    daily_mean_pct: round(mean * 100, 4),
    source: 'Yahoo Finance',
  };
}

/** Fund/ETF top holdings via Yahoo Finance quoteSummary. May not work for all TW ETFs. */
export async function holdings(ticker) {
  ensureReady();
  try {
    const s = await yahooFinance.quoteSummary(ticker, { modules: ['topHoldings', 'fundProfile'] });
    const top = s.topHoldings?.holdings || [];
    const sectors = s.topHoldings?.sectorWeightings || [];
    return {
      ticker,
      top_holdings: top.map((h) => ({
        symbol: h.symbol,
        name: h.holdingName,
        weight_pct: round((h.holdingPercent || 0) * 100, 3),
      })),
      sector_weightings: sectors.map((s) => {
        const k = Object.keys(s)[0];
        return { sector: k, weight_pct: round((s[k] || 0) * 100, 3) };
      }),
      source: 'Yahoo Finance (quoteSummary.topHoldings)',
    };
  } catch (e) {
    return { ticker, error: `quoteSummary failed: ${e.message}`, source: 'Yahoo Finance' };
  }
}
