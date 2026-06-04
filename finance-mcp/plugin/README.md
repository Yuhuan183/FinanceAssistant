# finance-local (Cowork 外掛) — v0.2

把本機 Node.js 直連的免費金融資料源（Yahoo Finance、TWSE 開放資料、FRED、投信官網、MOPS）透過 MCP 接進 Claude（Cowork、Desktop、排程任務皆可呼叫）。

設計目的是繞過 Cowork 沙箱對外網的存取限制——bridge 跑在你 Mac 本機，網路出口是你 Mac，因此可以正常抓 TWSE／yfinance／FRED 等服務。

## 內容

- **MCP server（`.mcp.json`）** — 啟動本機的 `finance-mcp-bridge`，把工具接進 Cowork。

## 暴露的工具（v0.2）

| 工具 | 用途 |
|---|---|
| `bridge_health` | **健康檢查** — 一發確認 8 個資料源中誰能用、誰 degraded、誰 fail，含回應時間 |
| `yf_quote` / `yf_quotes` | Yahoo Finance 單檔／批次報價（全球指數、美股、ETF、TW `.TW`、FX、商品） |
| `yf_preset` | 一鍵抓預設組合：`us-indices` / `us-portfolio` / `tw-portfolio` / `tw-index` / `macro` |
| `yf_history` | 近 N 日 OHLCV |
| `yf_stats` | 近 N 日累積報酬、年化波動度、最大回撤 |
| `yf_holdings` | ETF 穿透（QQQ/SMH/VOO/VT 等 US ETF 較準，TW ETF 用 `etf_holdings`） |
| `twse_taiex` | 加權指數官方收盤（TWSE 開放資料） |
| `twse_three_institutional` | 三大法人買賣超官方統計 |
| `twse_stock` | 個股日成交資訊（含與前日比較） |
| `fred_series` / `fred_multi` | FRED 美國總經序列 |
| `fred_macro_dashboard` | 預設總經儀表板（DGS10、DGS2、T10Y2Y、DFF、WTI、DXY、T10YIE） |
| `etf_holdings` | TW ETF 穿透成分（0050／0052／00631L／00663L／00981A） |
| `etf_lookthrough_tsmc` | 給定組合權重，回傳穿透後 TSMC 曝險與整體槓桿率 |
| `mops_monthly_revenue` | 個股月營收（TWSE OpenAPI 公開資訊觀測站；v0.2 起年份已轉成 AD 西元年、保留 `year_roc` 民國年） |
| `mops_ai_supply_chain` | 預設 AI 供應鏈月營收（2330／2317／2382／6669／2308） |

## v0.2 改動

- 新增 `bridge_health` 工具,一發狀態檢查
- `mops_monthly_revenue` 回傳 `year` 改為 AD 西元年（自動 +1911 轉換），另加 `year_roc` 欄保留民國年

## 先決條件

1. bridge 專案在 `/Users/zack/WorkSpace/cowrok-mcp-bridge/finance-mcp/`，且已跑過 `npm install`。
2. 本機裝有 Node.js 18 以上（`node --version` 確認）。
3. Mac 上線時 Claude 才能呼叫；睡眠或關機時排程任務會抓不到，應在 task.md 設計 fallback 回 WebSearch。

## 安裝

```bash
cd /Users/zack/WorkSpace/cowrok-mcp-bridge/finance-mcp
npm install
node src/server.mjs   # 嘗試啟動;按 Ctrl+C 結束(stdio server 沒有 stdin 會等)
```

正常啟動後不會印任何東西（stdio 模式）。要從本機驗證可以跑 `npm run smoke`（如有 smoke 腳本）或直接從 Claude 對話呼叫工具。

把 `.mcp.json` 的內容貼到 Claude Desktop / Cowork 的 MCP config——位置通常是：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

合併（不是覆蓋）`mcpServers` 區塊，然後**重啟 Claude／Cowork**。重啟後 ToolSearch 搜 `finance` 應該能看到 `mcp__finance_local__*` 系列工具。

## 設定

設定在 `.mcp.json`:`args` 指向 bridge 進入點 `src/server.mjs` 的絕對路徑（bridge 搬位置要同步改）。可選環境變數見 `.env.example`（`USER_AGENT`、`REQUEST_TIMEOUT_MS`）。

## 疑難排解

- **工具沒出現**：通常是路徑問題；確認 `command` 指向你機器的 node 絕對路徑（終端機 `which node` 取得），`args` 路徑存在；改完重啟 Claude。
- **某個 TWSE/MOPS 端點 403/404**：TWSE 有時會更動 endpoint；先試 `USER_AGENT` 環境變數調整；長期失效則需更新 `src/twse.mjs` 或 `src/mops.mjs`。
- **yahoo-finance2 卡住或回 401**：套件偶爾需更新；`cd finance-mcp && npm update yahoo-finance2`。
- **ETF 穿透回 "cached"**：表示 live 抓取失敗，自動退回快取值（人為策劃的公開資料近似值），已在回傳的 `source` 與 `is_live` 欄位中註明。

## 安全說明

bridge 對外只走 HTTP/HTTPS（公開金融資料 API、官方頁面），不開 shell；無任何寫入動作（純讀取）。資料流：你的 Mac → Claude 的對話脈絡 → Anthropic 後端，跟其他 Claude 對話相同。
