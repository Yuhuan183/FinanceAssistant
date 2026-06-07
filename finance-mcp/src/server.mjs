/**
 * finance-mcp-bridge — local MCP server exposing free financial data sources.
 *
 * Tool surface:
 *   yf_quote / yf_quotes / yf_preset / yf_history / yf_stats / yf_holdings
 *   twse_taiex / twse_three_institutional / twse_stock
 *   fred_series / fred_multi / fred_macro
 *   etf_holdings / etf_lookthrough_tsmc
 *   mops_monthly_revenue / mops_ai_supply_chain
 *
 * Transport: stdio. Designed to be launched by Claude Desktop / Cowork via
 * the plugin/.mcp.json config.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import * as yfin from './yfin.mjs';
import * as stooq from './stooq.mjs';
import * as twse from './twse.mjs';
import * as fred from './fred.mjs';
import * as etf from './etf_holdings.mjs';
import * as mops from './mops.mjs';
import * as gitops from './git.mjs';
import { ok, err } from './_util.mjs';

const server = new McpServer({ name: 'finance-local', version: '0.2.0' });

/* ============================================================
   Bridge Health — 一發狀態檢查
   ============================================================ */

server.registerTool(
  'bridge_health',
  {
    description:
      'Health check — 對六個資料源各打一發輕量測試,回報每個的 ok/degraded/fail 狀態與回應時間。用來在排程前確認哪些 source 現在能用。',
    inputSchema: {},
  },
  async () => {
    const tests = [
      ['yfin', () => yfin.quote('AAPL').then(r => r ? 'ok' : 'fail')],
      ['stooq', () => stooq.quote('NVDA').then(r => r?.error ? 'degraded' : 'ok')],
      ['twse_taiex', () => twse.taiex('2026-05-22').then(r => r?.error ? 'degraded' : 'ok')],
      ['twse_three_institutional', () => twse.threeInstitutional('2026-05-22').then(r => r?.error ? 'degraded' : 'ok')],
      ['twse_stock', () => twse.stock('2330', '2026-05-22').then(r => r?.error ? 'degraded' : 'ok')],
      ['fred', () => fred.series('DGS10', 5).then(r => r?.error ? 'degraded' : 'ok')],
      ['etf_holdings_cache', () => etf.holdings('0050').then(r => r?.error ? 'fail' : (r?.is_live ? 'ok-live' : 'ok-cached'))],
      ['mops', () => mops.monthlyRevenue('2330', 2026, 4).then(r => r?.error ? 'degraded' : 'ok')],
    ];
    const results = [];
    for (const [name, fn] of tests) {
      const t0 = Date.now();
      try {
        const status = await fn();
        results.push({ source: name, status, response_ms: Date.now() - t0 });
      } catch (e) {
        results.push({ source: name, status: 'fail', error: e.message.slice(0, 200), response_ms: Date.now() - t0 });
      }
    }
    const summary = {
      ok: results.filter(r => r.status === 'ok' || r.status === 'ok-live' || r.status === 'ok-cached').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      fail: results.filter(r => r.status === 'fail').length,
    };
    return ok({
      bridge_version: '0.2.0',
      checked_at: new Date().toISOString(),
      summary,
      results,
      hint:
        summary.fail === 0 && summary.degraded === 0
          ? 'all green — bridge fully operational'
          : summary.fail > 0
            ? 'some sources failed — check error messages; pre-market may need to fallback to WebSearch for those'
            : 'some sources degraded (returned error response but bridge itself working) — usually transient or known limitation',
    });
  },
);

/* ============================================================
   Yahoo Finance — global equity / ETF / FX / commodity
   ============================================================ */

server.registerTool(
  'yf_quote',
  {
    description:
      'Yahoo Finance: latest quote for a single ticker. Works for US equities/ETFs (NVDA, QQQ), indices (^GSPC, ^TWII), TW (.TW suffix, e.g. 0050.TW), FX (TWD=X), futures (CL=F).',
    inputSchema: {
      ticker: z.string().describe('Yahoo Finance ticker symbol, e.g. "NVDA", "^GSPC", "0050.TW", "CL=F".'),
    },
  },
  async ({ ticker }) => {
    try { return ok(await yfin.quote(ticker)); }
    catch (e) { return err(e.message, { ticker }); }
  },
);

server.registerTool(
  'yf_quotes',
  {
    description: 'Yahoo Finance: batch quotes for multiple tickers in a single call.',
    inputSchema: {
      tickers: z.array(z.string()).min(1).describe('Array of Yahoo tickers, e.g. ["NVDA","AMD","^GSPC"].'),
    },
  },
  async ({ tickers }) => {
    try { return ok(await yfin.quotes(tickers)); }
    catch (e) { return err(e.message, { tickers }); }
  },
);

server.registerTool(
  'yf_preset',
  {
    description:
      'Yahoo Finance: batch quote a named preset. Presets: "us-indices", "us-portfolio", "tw-portfolio", "tw-index", "macro".',
    inputSchema: {
      name: z.enum(['us-indices', 'us-portfolio', 'tw-portfolio', 'tw-index', 'macro']),
    },
  },
  async ({ name }) => {
    try { return ok(await yfin.preset(name)); }
    catch (e) { return err(e.message, { name }); }
  },
);

server.registerTool(
  'yf_history',
  {
    description: 'Yahoo Finance: daily OHLCV history for a ticker. Returns the most recent `days` trading days.',
    inputSchema: {
      ticker: z.string(),
      days: z.number().int().positive().default(30),
    },
  },
  async ({ ticker, days }) => {
    try { return ok(await yfin.history(ticker, days)); }
    catch (e) { return err(e.message, { ticker, days }); }
  },
);

server.registerTool(
  'yf_stats',
  {
    description:
      'Yahoo Finance: rolling statistics over the last `days` trading days — cumulative return %, annualized volatility %, max drawdown %.',
    inputSchema: {
      ticker: z.string(),
      days: z.number().int().positive().default(252),
    },
  },
  async ({ ticker, days }) => {
    try { return ok(await yfin.stats(ticker, days)); }
    catch (e) { return err(e.message, { ticker, days }); }
  },
);

server.registerTool(
  'yf_holdings',
  {
    description:
      'Yahoo Finance: ETF/fund top holdings & sector weightings (via quoteSummary.topHoldings). Coverage varies; works well for US ETFs (QQQ, SMH, VOO, VT), limited for TW ETFs (try etf_holdings instead).',
    inputSchema: {
      ticker: z.string(),
    },
  },
  async ({ ticker }) => {
    try { return ok(await yfin.holdings(ticker)); }
    catch (e) { return err(e.message, { ticker }); }
  },
);

/* ============================================================
   Stooq — 免認證的全球市場資料 CSV(yfinance 不穩時的主要 fallback)
   ============================================================ */

server.registerTool(
  'stooq_quote',
  {
    description:
      'Stooq: latest OHLCV for a ticker. 免認證、無 rate limit;比 Yahoo Finance 穩定。支援符號:US 個股(NVDA→nvda.us)、US ETF(QQQ→qqq.us)、US 指數(^SPX/^DJI/^IXIC/^SOX/^VIX)、TW 股(0050.TW)、TW 指數(^TWII)、FX(USDTWD)、商品(CL.F=WTI, GC.F=Gold)。可直接傳 Yahoo 風格符號,內部會自動轉換。',
    inputSchema: { ticker: z.string() },
  },
  async ({ ticker }) => {
    try { return ok(await stooq.quote(ticker)); }
    catch (e) { return err(e.message, { ticker }); }
  },
);

server.registerTool(
  'stooq_quotes',
  {
    description: 'Stooq: batch latest quotes for multiple tickers.',
    inputSchema: { tickers: z.array(z.string()).min(1) },
  },
  async ({ tickers }) => {
    try { return ok(await stooq.quotes(tickers)); }
    catch (e) { return err(e.message, { tickers }); }
  },
);

server.registerTool(
  'stooq_preset',
  {
    description: 'Stooq: batch quote a named preset. Presets: us-indices, us-portfolio, tw-portfolio, tw-index, macro.',
    inputSchema: { name: z.enum(['us-indices', 'us-portfolio', 'tw-portfolio', 'tw-index', 'macro']) },
  },
  async ({ name }) => {
    try { return ok(await stooq.preset(name)); }
    catch (e) { return err(e.message, { name }); }
  },
);

server.registerTool(
  'stooq_history',
  {
    description: 'Stooq: daily OHLCV history. 用來取代 Yahoo Finance v2.14 拿不到 historical 的功能。',
    inputSchema: {
      ticker: z.string(),
      days: z.number().int().positive().default(30),
    },
  },
  async ({ ticker, days }) => {
    try { return ok(await stooq.history(ticker, days)); }
    catch (e) { return err(e.message, { ticker, days }); }
  },
);

server.registerTool(
  'stooq_stats',
  {
    description: 'Stooq: rolling statistics over the last `days` trading days — cumulative return %, annualized vol %, max drawdown %.',
    inputSchema: {
      ticker: z.string(),
      days: z.number().int().positive().default(252),
    },
  },
  async ({ ticker, days }) => {
    try { return ok(await stooq.stats(ticker, days)); }
    catch (e) { return err(e.message, { ticker, days }); }
  },
);

/* ============================================================
   TWSE — 加權指數、三大法人、個股 (官方開放資料)
   ============================================================ */

server.registerTool(
  'twse_taiex',
  {
    description:
      'TWSE 加權指數 (TWII) — official OHLC close for a given trading date.',
    inputSchema: {
      date: z.string().describe('YYYY-MM-DD or YYYYMMDD'),
    },
  },
  async ({ date }) => {
    try { return ok(await twse.taiex(date)); }
    catch (e) { return err(e.message, { date }); }
  },
);

server.registerTool(
  'twse_three_institutional',
  {
    description:
      'TWSE 三大法人買賣超 — official daily summary of net buy/sell by 外資, 投信, 自營商 (proprietary + hedge). Amounts are NT$ thousands.',
    inputSchema: {
      date: z.string().describe('YYYY-MM-DD or YYYYMMDD'),
    },
  },
  async ({ date }) => {
    try { return ok(await twse.threeInstitutional(date)); }
    catch (e) { return err(e.message, { date }); }
  },
);

server.registerTool(
  'twse_stock',
  {
    description:
      'TWSE 個股日成交資訊 — official daily OHLCV for a specific Taiwan-listed stock (e.g. "2330" for 台積電, "0050" for 元大台灣50). Returns the target date plus prev-close comparison.',
    inputSchema: {
      code: z.string().describe('Stock code, e.g. "2330".'),
      date: z.string().describe('YYYY-MM-DD or YYYYMMDD'),
    },
  },
  async ({ code, date }) => {
    try { return ok(await twse.stock(code, date)); }
    catch (e) { return err(e.message, { code, date }); }
  },
);

/* ============================================================
   FRED — US macro
   ============================================================ */

server.registerTool(
  'fred_series',
  {
    description:
      'FRED time series — fetch a single FRED series CSV and return latest observations. Common IDs: DGS10 (10y), DGS2 (2y), T10Y2Y (spread), DFF (Fed funds), DCOILWTICO (WTI), DTWEXBGS (USD index), T10YIE (10y breakeven).',
    inputSchema: {
      series_id: z.string().describe('FRED series ID, e.g. "DGS10".'),
      days: z.number().int().positive().default(60),
    },
  },
  async ({ series_id, days }) => {
    try { return ok(await fred.series(series_id, days)); }
    catch (e) { return err(e.message, { series_id, days }); }
  },
);

server.registerTool(
  'fred_multi',
  {
    description: 'FRED — fetch multiple series in one call.',
    inputSchema: {
      series_ids: z.array(z.string()).min(1),
      days: z.number().int().positive().default(30),
    },
  },
  async ({ series_ids, days }) => {
    try { return ok(await fred.multi(series_ids, days)); }
    catch (e) { return err(e.message, { series_ids, days }); }
  },
);

server.registerTool(
  'fred_macro_dashboard',
  {
    description:
      'FRED — preset macro dashboard: DGS10, DGS2, T10Y2Y, DFF, DCOILWTICO, DTWEXBGS, T10YIE for the last 30 days.',
    inputSchema: {},
  },
  async () => {
    try { return ok(await fred.macroDashboard()); }
    catch (e) { return err(e.message); }
  },
);

/* ============================================================
   ETF Holdings — TW 投信穿透成分
   ============================================================ */

server.registerTool(
  'etf_holdings',
  {
    description:
      'TW ETF 穿透成分 — returns top holdings, TSMC look-through weight, tracked index. Supported codes: 0050, 0052, 00631L, 00663L, 00981A. Best-effort live fetch with cached fallback (clearly labeled).',
    inputSchema: {
      code: z.string().describe('ETF code, e.g. "0050".'),
    },
  },
  async ({ code }) => {
    try { return ok(await etf.holdings(code)); }
    catch (e) { return err(e.message, { code }); }
  },
);

server.registerTool(
  'etf_lookthrough_tsmc',
  {
    description:
      "Given the user's portfolio weights (as % of NAV) keyed by code, compute the portfolio's pass-through TSMC exposure and total nominal exposure (accounting for 2x leverage on 00631L/00663L). Returns leverage ratio and TSMC share of total exposure.",
    inputSchema: {
      weights_by_code: z
        .record(z.string(), z.number())
        .describe('Object mapping ETF/stock code to weight %, e.g. {"0050":20.2,"0052":11,"00631L":11.3,"00663L":32.6,"00981A":9.7,"2330":15.3}'),
    },
  },
  async ({ weights_by_code }) => {
    try { return ok(await etf.lookThroughTsmc(weights_by_code)); }
    catch (e) { return err(e.message); }
  },
);

/* ============================================================
   MOPS — 月營收
   ============================================================ */

server.registerTool(
  'mops_monthly_revenue',
  {
    description:
      "MOPS 公開資訊觀測站 — fetch a single TW listed stock's monthly revenue for a given year/month. Returns revenue, MoM%, YoY%, YTD%. Coverage best for 上市 stocks.",
    inputSchema: {
      stock: z.string().describe('Stock code, e.g. "2330".'),
      year: z.number().int().describe('AD year, e.g. 2026.'),
      month: z.number().int().min(1).max(12),
    },
  },
  async ({ stock, year, month }) => {
    try { return ok(await mops.monthlyRevenue(stock, year, month)); }
    catch (e) { return err(e.message, { stock, year, month }); }
  },
);

server.registerTool(
  'mops_ai_supply_chain',
  {
    description:
      'MOPS — fetch monthly revenue for the AI supply chain preset: 2330 台積電, 2317 鴻海, 2382 廣達, 6669 緯穎, 2308 台達電.',
    inputSchema: {
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    },
  },
  async ({ year, month }) => {
    try { return ok(await mops.aiSupplyChainRevenue(year, month)); }
    catch (e) { return err(e.message, { year, month }); }
  },
);

/* ============================================================
   Git — 本機 git 操作（跑在 Mac，可直連 GitHub）
   ============================================================ */

server.registerTool(
  'git_status',
  {
    description:
      '本機 git 狀態：目前分支、與上游的 ahead/behind、工作區是否乾淨與變更清單。用來在 commit/push 前確認狀態。',
    inputSchema: {
      repo: z.string().describe('git repo 的絕對路徑，例如 "/Users/siegfried/WorkSpace/FinanceAssistant"。'),
    },
  },
  async ({ repo }) => {
    try { return ok(await gitops.status(repo)); }
    catch (e) { return err(e.message, { repo }); }
  },
);

server.registerTool(
  'git_commit',
  {
    description:
      '在本機 repo 暫存並 commit。files 省略＝git add -A（全部）；給陣列則只加指定路徑。無變更時回 nothing:true。不會 push。',
    inputSchema: {
      repo: z.string().describe('git repo 絕對路徑。'),
      message: z.string().describe('commit 訊息，建議格式「<類型>: <說明>」。'),
      files: z.array(z.string()).optional().describe('要納入的相對路徑陣列；省略＝加入全部變更。'),
    },
  },
  async ({ repo, message, files }) => {
    try { return ok(await gitops.commit(repo, { message, files })); }
    catch (e) { return err(e.message, { repo }); }
  },
);

server.registerTool(
  'git_push',
  {
    description:
      '把本機 commit push 到遠端（預設 origin + 目前分支）。使用本機 SSH 金鑰直連 GitHub。絕不 force push。',
    inputSchema: {
      repo: z.string().describe('git repo 絕對路徑。'),
      remote: z.string().default('origin').describe('遠端名稱，預設 origin。'),
      branch: z.string().optional().describe('目標分支；省略＝目前分支。'),
    },
  },
  async ({ repo, remote, branch }) => {
    try { return ok(await gitops.push(repo, { remote, branch })); }
    catch (e) { return err(e.message, { repo }); }
  },
);

server.registerTool(
  'git_fetch',
  {
    description: '從遠端 fetch（預設 origin，--prune）。只更新遠端追蹤分支，不改工作區。',
    inputSchema: {
      repo: z.string().describe('git repo 絕對路徑。'),
      remote: z.string().default('origin').describe('遠端名稱，預設 origin。'),
      prune: z.boolean().default(true).describe('是否 --prune 清掉已刪除的遠端分支。'),
    },
  },
  async ({ repo, remote, prune }) => {
    try { return ok(await gitops.fetch(repo, { remote, prune })); }
    catch (e) { return err(e.message, { repo }); }
  },
);

server.registerTool(
  'git_pull',
  {
    description:
      '從遠端 pull（預設 origin + 目前分支 + --rebase）。遇衝突會回報，需手動解決。',
    inputSchema: {
      repo: z.string().describe('git repo 絕對路徑。'),
      remote: z.string().default('origin').describe('遠端名稱，預設 origin。'),
      branch: z.string().optional().describe('來源分支；省略＝目前分支。'),
      rebase: z.boolean().default(true).describe('是否用 --rebase（預設 true）。'),
    },
  },
  async ({ repo, remote, branch, rebase }) => {
    try { return ok(await gitops.pull(repo, { remote, branch, rebase })); }
    catch (e) { return err(e.message, { repo }); }
  },
);

server.registerTool(
  'git_publish',
  {
    description:
      '便利組合：add + commit + push 一次完成。給 repo 與 message 即可發布；files 省略＝全部變更。發布報告到 GitHub Pages 時用這個最省事。',
    inputSchema: {
      repo: z.string().describe('git repo 絕對路徑。'),
      message: z.string().describe('commit 訊息。'),
      files: z.array(z.string()).optional().describe('要納入的相對路徑；省略＝全部變更。'),
      remote: z.string().default('origin').describe('遠端名稱，預設 origin。'),
      branch: z.string().optional().describe('目標分支；省略＝目前分支。'),
    },
  },
  async ({ repo, message, files, remote, branch }) => {
    try { return ok(await gitops.publish(repo, { message, files, remote, branch })); }
    catch (e) { return err(e.message, { repo }); }
  },
);

/* ============================================================
   Boot
   ============================================================ */

const transport = new StdioServerTransport();
await server.connect(transport);
