/**
 * Stooq integration — 免認證、無 rate limit 的全球市場資料 CSV 端點。
 * 用來取代 yahoo-finance2 在 Yahoo 429 / API 不穩時的不可用問題。
 *
 * Symbol 規則(全小寫):
 *   US 個股:     aapl.us / nvda.us
 *   US ETF:      qqq.us / smh.us / voo.us / vt.us
 *   US 指數:     ^spx (S&P500) / ^dji / ^ixic (NASDAQ) / ^sox / ^vix
 *   TW 個股:     2330.tw / 2317.tw
 *   TW ETF:      0050.tw / 0052.tw / 00631l.tw / 00663l.tw / 00981a.tw
 *   TW 指數:     ^twii
 *   FX:          usdtwd / eurusd
 *   商品:        cl.f (WTI) / gc.f (黃金)
 *
 * 端點:
 *   即時:  https://stooq.com/q/l/?s=<sym>&f=sd2t2ohlcv&h&e=csv
 *   歷史:  https://stooq.com/q/d/l/?s=<sym>&d1=YYYYMMDD&d2=YYYYMMDD&i=d
 */
import { getText, parseCsv, num, round, ymd, isoDate } from './_util.mjs';
import * as td from './twelvedata.mjs';

const BASE_QUOTE = 'https://stooq.com/q/l/?f=sd2t2ohlcv&h&e=csv&s=';
const BASE_HIST = 'https://stooq.com/q/d/l/?i=d&s=';

// 讓請求更像瀏覽器,best-effort 繞過 Stooq 的反爬攔截頁(noscript interstitial)。
// 注意:若 Stooq 是 IP 級封鎖,header 調整無效,此時 quote() 會自動退回 Twelve Data。
const STOOQ_HEADERS = {
  Accept: 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://stooq.com/',
};

/** 偵測回傳是否為反爬攔截頁(HTML/noscript)而非 CSV. */
function looksBlocked(text) {
  if (!text) return true;
  const head = text.slice(0, 200).toLowerCase();
  return head.includes('<html') || head.includes('noscript') || head.includes('<!doctype');
}

/** Stooq 失效時退回 Twelve Data(若已設 key);否則回原始錯誤. */
async function fallbackTd(ticker, stooqSym, reason) {
  if (td.available()) {
    try {
      const t = await td.quote(ticker);
      if (!t.error && t.close !== null) {
        return { ...t, source: `${t.source} (Stooq fallback;${reason})` };
      }
    } catch (e) {
      return { ticker, stooq_symbol: stooqSym, error: `${reason};Twelve Data 退路亦失敗:${e.message}` };
    }
  }
  return {
    ticker,
    stooq_symbol: stooqSym,
    error: `${reason}${td.available() ? '' : '(未設 TWELVEDATA_API_KEY,無退路)'}`,
  };
}

/**
 * Normalize ticker → Stooq symbol.
 * 兩件複雜事:
 *   1) Stooq 對主要指數(S&P500、Dow、Nasdaq100、SOX)因授權問題不開放 raw index;
 *      我們改用 ETF proxy(SPY/DIA/QQQ/SMH)取得方向性的價格與變動。
 *   2) TW 股票/ETF 在 Stooq 覆蓋極差;直接回 `null` 讓呼叫端走 TWSE 路徑。
 */
function normalize(symbol) {
  if (!symbol) return symbol;
  let s = String(symbol).trim();
  // Yahoo 風格的指數符號 → Stooq ETF proxy
  const yMap = {
    '^GSPC': 'spy.us',   // S&P 500 → SPY ETF
    '^DJI': 'dia.us',    // Dow → DIA ETF
    '^IXIC': 'qqq.us',   // Nasdaq Composite → QQQ (近似,實為 NDX-100)
    '^NDX': 'qqq.us',
    '^SOX': 'smh.us',    // 費半 → SMH ETF
    '^VIX': '^vix',
    '^TWII': '^twii',
    '^TNX': '^tnx',
    '^FVX': '^fvx',
    '^SPX': 'spy.us',
  };
  const upper = s.toUpperCase();
  if (yMap[upper]) return yMap[upper];
  // TW 標的 Stooq 覆蓋差,標記讓呼叫端知道
  if (/\.tw$/i.test(s)) return null; // 訊號:不要用 Stooq
  // 已經帶 .xx 後綴或 ^ 前綴的,只小寫
  if (/\.|\^|=/.test(s)) return s.toLowerCase();
  // 預設視為美股
  return s.toLowerCase() + '.us';
}

/**
 * 取單檔最新報價(today's close 或 latest tick depending on Stooq freshness).
 */
export async function quote(symbol) {
  const sym = normalize(symbol);
  if (sym === null) {
    return {
      ticker: symbol,
      error: 'TW symbol — Stooq coverage is unreliable for Taiwan; use twse_taiex / twse_stock instead',
    };
  }
  let csv = '';
  try {
    csv = await getText(BASE_QUOTE + encodeURIComponent(sym), { headers: STOOQ_HEADERS });
  } catch (e) {
    return fallbackTd(symbol, sym, `Stooq fetch failed: ${e.message}`);
  }
  const rows = looksBlocked(csv) ? [] : parseCsv(csv);
  const r = rows[0] || {};
  const close0 = num(r.Close);
  // Stooq 無資料用 "N/D";被反爬時回 HTML(close0 會是 null)
  if (!rows.length || r.Date === 'N/D' || r.Close === 'N/D' || close0 === null) {
    return fallbackTd(symbol, sym, `Stooq 無有效資料(N/D 或反爬攔截);sym=${sym}`);
  }
  const close = close0;
  const open = num(r.Open);
  const high = num(r.High);
  const low = num(r.Low);
  return {
    ticker: symbol,
    stooq_symbol: sym,
    date: r.Date || null,
    time: r.Time || null,
    open: round(open, 4),
    high: round(high, 4),
    low: round(low, 4),
    close: round(close, 4),
    volume: num(r.Volume),
    source: `Stooq ${BASE_QUOTE}${sym}`,
  };
}

/** 多檔批次報價(內部用迴圈呼叫). */
export async function quotes(symbols) {
  return Promise.all(symbols.map((s) => quote(s).catch((e) => ({ ticker: s, error: e.message }))));
}

/**
 * 近 N 日 OHLCV 歷史. days 預設 30.
 * 依序試多種 URL 變體(Stooq 的 history endpoint 對 param order/d1/d2 行為不一致):
 *   1) ?s=&d1=&d2=&i=d                — 帶日期範圍
 *   2) ?s=&i=d                         — 無日期(會回所有歷史)
 *   3) ?s=&i=d&o=1111111               — 明確要求所有欄位
 * 取第一個解析出 >= 2 row 的版本。
 */
export async function history(symbol, days = 30) {
  const sym = normalize(symbol);
  if (sym === null) {
    return {
      ticker: symbol,
      error: 'TW symbol — Stooq coverage is unreliable for Taiwan; use twse_stock instead',
    };
  }
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(days * 2, 60) * 86400_000);
  const d1 = ymd(start);
  const d2 = ymd(end);
  const sx = encodeURIComponent(sym);
  const candidates = [
    `https://stooq.com/q/d/l/?s=${sx}&d1=${d1}&d2=${d2}&i=d`,
    `https://stooq.com/q/d/l/?s=${sx}&i=d`,
    `https://stooq.com/q/d/l/?s=${sx}&i=d&o=1111111`,
    `https://stooq.com/q/d/l/?i=d&s=${sx}`,
  ];

  const attempts = [];
  for (const url of candidates) {
    let csv;
    try {
      csv = await getText(url, { headers: STOOQ_HEADERS });
    } catch (e) {
      attempts.push({ url, error: e.message });
      continue;
    }
    const preview = (csv || '').slice(0, 120).replace(/\n/g, '|');
    const rows = looksBlocked(csv) ? [] : parseCsv(csv || '').filter((r) => r.Date && r.Date !== 'N/D');
    attempts.push({ url, length: csv?.length || 0, preview, rows: rows.length });
    if (rows.length >= 2) {
      const recent = rows.slice(-days).map((r) => ({
        date: r.Date,
        open: round(num(r.Open), 4),
        high: round(num(r.High), 4),
        low: round(num(r.Low), 4),
        close: round(num(r.Close), 4),
        volume: num(r.Volume),
      }));
      return {
        ticker: symbol,
        stooq_symbol: sym,
        days: recent.length,
        history: recent,
        source: `Stooq ${url}`,
      };
    }
  }
  return {
    ticker: symbol,
    stooq_symbol: sym,
    error: 'no usable history from any URL pattern',
    diagnostic: attempts,
  };
}

/** 近 N 日的累積報酬、年化波動度、最大回撤. */
export async function stats(symbol, days = 252) {
  const h = await history(symbol, days);
  if (h.error) return h;
  const closes = h.history.map((r) => r.close).filter((v) => v !== null);
  if (closes.length < 2) return { ticker: symbol, error: 'insufficient data' };
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const annVol = Math.sqrt(variance) * Math.sqrt(252);
  let peak = closes[0];
  let mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = c / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  return {
    ticker: symbol,
    stooq_symbol: h.stooq_symbol,
    days: closes.length,
    cum_return_pct: round((closes[closes.length - 1] / closes[0] - 1) * 100, 2),
    annualized_vol_pct: round(annVol * 100, 2),
    max_drawdown_pct: round(mdd * 100, 2),
    daily_mean_pct: round(mean * 100, 4),
    source: h.source,
  };
}

export const PRESETS = {
  'us-indices': ['^GSPC', '^DJI', '^IXIC', '^SOX', '^VIX'],
  'us-portfolio': ['NVDA', 'AMD', 'GOOGL', 'QQQ', 'SMH', 'VOO', 'VT'],
  'tw-portfolio': ['0050.TW', '0052.TW', '00631L.TW', '00663L.TW', '00981A.TW', '2330.TW'],
  'tw-index': ['^TWII'],
  'macro': ['CL.F', 'GC.F', 'USDTWD', '^TNX'],
};

export async function preset(name) {
  const list = PRESETS[name];
  if (!list) throw new Error(`unknown preset: ${name}; choices: ${Object.keys(PRESETS).join(', ')}`);
  return quotes(list);
}
