#!/usr/bin/env node
/**
 * Smoke test — run each module's most important function and print the result.
 * Useful for verifying network access + each data source works before installing
 * the MCP server into Claude.
 *
 * Usage:
 *   npm install
 *   node scripts/smoke.mjs
 */
import * as yfin from '../src/yfin.mjs';
import * as stooq from '../src/stooq.mjs';
import * as twse from '../src/twse.mjs';
import * as fred from '../src/fred.mjs';
import * as etf from '../src/etf_holdings.mjs';
import * as mops from '../src/mops.mjs';

const LINE = '─'.repeat(70);

async function run(label, fn) {
  console.log('\n' + LINE);
  console.log('▶ ' + label);
  console.log(LINE);
  try {
    const t0 = Date.now();
    const r = await fn();
    const ms = Date.now() - t0;
    console.log(JSON.stringify(r, null, 2));
    console.log(`✓ ${label} (${ms}ms)`);
    return true;
  } catch (e) {
    console.error(`✗ ${label} FAILED: ${e.message}`);
    return false;
  }
}

const today = new Date();
// 用「最近的合理交易日」當作測試日 — 直接用今天,假日就回 error
const isoToday = today.toISOString().slice(0, 10);

// 取近一個交易日 — 退到上週五,避開週末
function lastFriday(d = new Date()) {
  const x = new Date(d);
  while (x.getDay() !== 5) x.setDate(x.getDate() - 1);
  return x;
}
const isoYesterday = lastFriday().toISOString().slice(0, 10);

const tests = [
  // ---- Stooq: 取代 yfinance 不穩的核心市場資料 ----
  ['Stooq: S&P 500 via SPY proxy', () => stooq.quote('^GSPC')], // → spy.us
  ['Stooq: NVDA quote', () => stooq.quote('NVDA')],
  ['Stooq: us-portfolio preset', () => stooq.preset('us-portfolio')],
  ['Stooq: NVDA 30-day stats', () => stooq.stats('NVDA', 30)],
  ['Stooq: TW symbol (應該回 fallback 訊息)', () => stooq.quote('0050.TW')],
  // ---- Yahoo Finance: 留 quote 試試,Yahoo 429 時會 fail ----
  ['Yahoo Finance: S&P 500 quote (可能 429,可忽略)', () => yfin.quote('^GSPC')],
  ['TWSE: 加權指數 (recent)', () => twse.taiex(isoYesterday)],
  ['TWSE: 三大法人 (recent)', () => twse.threeInstitutional(isoYesterday)],
  ['TWSE: 2330 個股 (recent)', () => twse.stock('2330', isoYesterday)],
  ['FRED: DGS10 (10y yield)', () => fred.series('DGS10', 10)],
  ['FRED: macro dashboard', () => fred.macroDashboard()],
  ['ETF: 0050 holdings', () => etf.holdings('0050')],
  [
    'ETF: TSMC look-through (sample portfolio)',
    () =>
      etf.lookThroughTsmc({
        '0050': 20.2, '0052': 11.0, '00631L': 11.3, '00663L': 32.6, '00981A': 9.7, '2330': 15.3,
      }),
  ],
  ['MOPS: 2330 monthly revenue (上月)',
    () => {
      // 取「上一個月」(MOPS 月營收通常隔月 10 日前公布)
      const d = new Date(today);
      d.setDate(0); // last day of previous month
      return mops.monthlyRevenue('2330', d.getFullYear(), d.getMonth() + 1);
    }],
];

let pass = 0;
let fail = 0;
for (const [label, fn] of tests) {
  const ok = await run(label, fn);
  if (ok) pass++; else fail++;
}

console.log('\n' + '═'.repeat(70));
console.log(`SMOKE TEST SUMMARY: ${pass} passed, ${fail} failed (of ${tests.length})`);
console.log('═'.repeat(70));
process.exit(fail ? 1 : 0);
