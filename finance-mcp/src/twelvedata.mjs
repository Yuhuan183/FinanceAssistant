/**
 * Twelve Data integration — 免費版行情(美股個股/ETF/指數/匯率)。
 * 用來在 Stooq 反爬、yahoo-finance2 429 時提供穩定的美股盤後收盤。
 *
 * 免費 key 申請:https://twelvedata.com/pricing (Free 方案約 800 calls/日、8/分)。
 * 設定環境變數 TWELVEDATA_API_KEY 後自動啟用。
 *
 * 端點:GET https://api.twelvedata.com/quote?symbol=NVDA&apikey=KEY  → JSON
 */
import { getJson, num, round } from './_util.mjs';

const BASE = 'https://api.twelvedata.com';
const apiKey = () => process.env.TWELVEDATA_API_KEY || '';

/** 是否已設定 key. */
export function available() {
  return !!apiKey();
}

/**
 * 把我們慣用的 Yahoo 風格 / preset 符號 → Twelve Data 符號。
 *   ^GSPC/^SPX → SPX, ^DJI → DJI, ^IXIC → IXIC, ^NDX → NDX,
 *   ^SOX → SOX, ^VIX → VIX, ^TNX → TNX, ^TWII → TAIEX
 *   USDTWD → USD/TWD, CL.F/CL=F → WTI/USD, GC.F/GC=F → XAU/USD
 *   nvda.us → NVDA, 0050.tw → 0050(交易所 TWSE)
 */
function tdSymbol(sym) {
  const s = String(sym || '').trim();
  const u = s.toUpperCase();
  const map = {
    '^GSPC': 'SPX', '^SPX': 'SPX', '^DJI': 'DJI', '^IXIC': 'IXIC', '^NDX': 'NDX',
    '^SOX': 'SOX', '^VIX': 'VIX', '^TNX': 'TNX', '^TWII': 'TAIEX',
    'USDTWD': 'USD/TWD', 'TWD=X': 'USD/TWD',
    'CL.F': 'WTI/USD', 'CL=F': 'WTI/USD', 'GC.F': 'XAU/USD', 'GC=F': 'XAU/USD',
  };
  if (map[u]) return { symbol: map[u] };
  if (u.endsWith('.US')) return { symbol: u.slice(0, -3) };
  if (/\.TW$/i.test(s)) return { symbol: s.replace(/\.tw$/i, ''), exchange: 'TWSE' };
  return { symbol: u };
}

/** 取單檔最新報價. */
export async function quote(symbol) {
  const key = apiKey();
  if (!key) return { ticker: symbol, error: 'TWELVEDATA_API_KEY 未設定' };
  const { symbol: td, exchange } = tdSymbol(symbol);
  let url = `${BASE}/quote?symbol=${encodeURIComponent(td)}&apikey=${key}`;
  if (exchange) url += `&exchange=${encodeURIComponent(exchange)}`;
  const j = await getJson(url);
  // Twelve Data 以 200 + {status:'error'} 回報壞符號/額度問題
  if (j.status === 'error' || j.code) {
    return { ticker: symbol, td_symbol: td, error: j.message || `twelvedata code ${j.code}` };
  }
  const close = num(j.close);
  return {
    ticker: symbol,
    td_symbol: td,
    name: j.name || null,
    date: j.datetime || null,
    open: round(num(j.open), 4),
    high: round(num(j.high), 4),
    low: round(num(j.low), 4),
    close: round(close, 4),
    previous_close: round(num(j.previous_close), 4),
    change: round(num(j.change), 4),
    percent_change: round(num(j.percent_change), 4),
    volume: num(j.volume),
    is_market_open: j.is_market_open ?? null,
    source: 'Twelve Data /quote',
  };
}

/** 多檔批次報價(免費版有每分鐘限制,呼叫端自行節制). */
export async function quotes(symbols) {
  return Promise.all(symbols.map((s) => quote(s).catch((e) => ({ ticker: s, error: e.message }))));
}

export const PRESETS = {
  'us-indices': ['^GSPC', '^DJI', '^IXIC', '^SOX', '^VIX'],
  'us-portfolio': ['NVDA', 'AMD', 'GOOGL', 'QQQ', 'SOXX', 'SOXQ', 'VOO', 'VT'],
  'macro': ['USDTWD', '^TNX'],
};

export async function preset(name) {
  const list = PRESETS[name];
  if (!list) throw new Error(`unknown preset: ${name}; choices: ${Object.keys(PRESETS).join(', ')}`);
  return quotes(list);
}
