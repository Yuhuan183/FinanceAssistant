# finance-local (Cowork 外掛) — v0.3

把本機 Node.js 直連的免費金融資料源（Yahoo Finance、TWSE 開放資料、FRED、Stooq、MOPS）透過 MCP 接進 Claude（Cowork、Desktop、排程任務皆可呼叫），並提供**本機 git 工具**讓 Claude／排程能直接把報告 commit／push 到 GitHub。

設計目的是繞過 Cowork 沙箱對外網的存取限制——bridge 跑在你 Mac 本機，網路出口是你 Mac，因此可以正常抓 TWSE／yfinance／FRED 等服務，也能用你本機的 SSH 金鑰直連 GitHub（沙箱連 github.com 的 DNS 都不通，做不到這件事）。

## 內容

- **MCP server（`.mcp.json`）** — 啟動本機的 `finance-mcp-bridge`，把工具接進 Cowork／Desktop。

## 暴露的工具（v0.3）

### 市場資料

| 工具 | 用途 |
|---|---|
| `bridge_health` | **健康檢查** — 一發確認 8 個資料源中誰能用、誰 degraded、誰 fail，含回應時間 |
| `yf_quote` / `yf_quotes` | Yahoo Finance 單檔／批次報價（全球指數、美股、ETF、TW `.TW`、FX、商品） |
| `yf_preset` | 一鍵抓預設組合：`us-indices` / `us-portfolio` / `tw-portfolio` / `tw-index` / `macro` |
| `yf_history` | 近 N 日 OHLCV |
| `yf_stats` | 近 N 日累積報酬、年化波動度、最大回撤 |
| `yf_holdings` | ETF 穿透（QQQ／SOXX／SOXQ／VOO／VT 等 US ETF 較準，TW ETF 用 `etf_holdings`） |
| `stooq_quote` / `stooq_quotes` / `stooq_preset` / `stooq_history` / `stooq_stats` | Stooq 報價／預設組合／歷史／統計（yfinance 被限流時的備援） |
| `twse_taiex` | 加權指數官方收盤（TWSE 開放資料） |
| `twse_three_institutional` | 三大法人買賣超官方統計 |
| `twse_stock` | 個股日成交資訊（含與前日比較） |
| `fred_series` / `fred_multi` | FRED 美國總經序列 |
| `fred_macro_dashboard` | 預設總經儀表板（DGS10、DGS2、T10Y2Y、DFF、WTI、DXY、T10YIE） |
| `etf_holdings` | TW ETF 穿透成分（0050／0052／00631L／00663L／00981A） |
| `etf_lookthrough_tsmc` | 給定組合權重，回傳穿透後 TSMC 曝險與整體槓桿率 |
| `mops_monthly_revenue` | 個股月營收（TWSE OpenAPI 公開資訊觀測站；年份已轉成 AD 西元年、保留 `year_roc` 民國年） |
| `mops_ai_supply_chain` | 預設 AI 供應鏈月營收（2330／2317／2382／6669／2308） |

### 本機 git（v0.3 新增）

所有 git 工具都吃一個 `repo` 絕對路徑參數，在你 Mac 本機執行、用你的 SSH 金鑰直連 GitHub。**絕不 force push**；以 `execFile` 帶參數陣列呼叫 git，不經 shell。

| 工具 | 用途 |
|---|---|
| `git_status` | 目前分支、與上游的 ahead/behind、工作區是否乾淨與變更清單 |
| `git_commit` | 暫存並 commit（`files` 省略＝全部變更；無變更回 `nothing:true`），不 push |
| `git_push` | 把本機 commit push 到遠端（預設 origin＋目前分支） |
| `git_fetch` | 從遠端 fetch（預設 origin，`--prune`） |
| `git_pull` | 從遠端 pull（預設 origin＋目前分支＋`--rebase`） |
| `git_publish` | 便利組合：add＋commit＋push 一次完成（發布報告到 GitHub Pages 最省事） |

## 版本改動

**v0.3**
- 新增本機 git 工具：`git_status` / `git_commit` / `git_push` / `git_fetch` / `git_pull` / `git_publish`，讓 Cowork／排程能透過本機直接發布到 GitHub（沙箱無法 push）。
- bridge 進入點路徑改至 `/Users/siegfried/WorkSpace/FinanceAssistant/finance-mcp/`（隨專案資料夾一起版控）。

**v0.2**
- 新增 `bridge_health` 工具，一發狀態檢查。
- `mops_monthly_revenue` 回傳 `year` 改為 AD 西元年（自動 +1911），另加 `year_roc` 欄保留民國年。

## 先決條件

1. bridge 專案在 `/Users/siegfried/WorkSpace/FinanceAssistant/finance-mcp/`，且已跑過 `npm install`。
2. 本機裝有 Node.js 18 以上（`node --version` 確認）。
3. 要用 git 工具 push：本機 SSH 金鑰已加到 GitHub 帳號（`ssh -T git@github.com` 應回 `Hi <帳號>!`）。
4. Mac 上線時 Claude 才能呼叫；睡眠或關機時排程任務會抓不到，應在 task.md 設計 fallback 回 WebSearch。

## 安裝

```bash
cd /Users/siegfried/WorkSpace/FinanceAssistant/finance-mcp
npm install
node src/server.mjs   # 嘗試啟動;按 Ctrl+C 結束(stdio server 沒有 stdin 會等)
```

正常啟動後不會印任何東西（stdio 模式）。

安裝方式有兩種，擇一：
- **打包成 `.plugin` 安裝**：在 Cowork／Desktop 載入本目錄打包出的 `finance-local.plugin`（內含 `.mcp.json`）。
- **手動合併 config**：把 `.mcp.json` 的 `mcpServers` 區塊**合併**（非覆蓋）到 `~/Library/Application Support/Claude/claude_desktop_config.json`。

兩種都要**重啟 Claude／Cowork**。重啟後 ToolSearch 搜 `finance` 或 `git_` 應能看到 `mcp__...finance-local__*` 系列工具。

## 設定

設定在 `.mcp.json`:`args` 指向 bridge 進入點 `src/server.mjs` 的**絕對路徑**（bridge 搬位置一定要同步改這條，否則 server 起不來、工具全部不註冊）。可選環境變數見 `.env.example`（`USER_AGENT`、`REQUEST_TIMEOUT_MS`、git 逾時 `GIT_TIMEOUT_MS`）。

## 疑難排解

- **工具沒出現**：通常是路徑問題；確認 `command` 指向你機器的 node 絕對路徑（終端機 `which node`），`args` 的 `server.mjs` 路徑存在；改完重啟 Claude。
- **`git_push` 回 Permission denied / publickey**：本機 SSH 金鑰沒加到該 GitHub 帳號；`pbcopy < ~/.ssh/id_rsa.pub` 後加到 GitHub → Settings → SSH keys，再 `ssh -T git@github.com` 確認。
- **`git_push` 回 non-fast-forward**：遠端有新 commit；先 `git_pull`（rebase）再 `git_push`。
- **某個 TWSE/MOPS 端點 403/404**：先試 `USER_AGENT` 環境變數；長期失效則更新 `src/twse.mjs` 或 `src/mops.mjs`。
- **yahoo-finance2 卡住或回 401/429**：`cd finance-mcp && npm update yahoo-finance2`；或改用 `stooq_*` 工具備援。
- **ETF 穿透回 "cached"**：live 抓取失敗自動退回快取值（公開資料近似值），已在回傳的 `source`／`is_live` 欄位註明。

## 安全說明

- **資料工具**：對外只走 HTTP/HTTPS（公開金融資料 API、官方頁面），純讀取。
- **git 工具（v0.3）**：會在本機執行 `git` 子程序，並**會寫入指定的 repo（commit）與推送到遠端（push）**。皆以 `execFile` 帶參數陣列呼叫、不經 shell，且**絕不 force push**；認證走你本機既有的 SSH 金鑰，bridge 本身不持有、不記錄任何 token。git 工具只操作呼叫方傳入的 `repo` 路徑。
- 資料流：你的 Mac →（git push 時）GitHub／Claude 對話脈絡 → Anthropic 後端，跟其他 Claude 對話相同。
