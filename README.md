# Finance Assistant

個人財報研究與市場分析的資料彙整,聚焦美股與台股的 AI／半導體焦點標的。

## 內容

- **`index.html`** — 財報觀察日曆,網站首頁。依日期檢視美股／台股財報行程,並可點進各標的的財報分析儀表板與每日盤前分析。
- **`analysis-archive/`** — 依股票代號歸檔的深入分析
  - `NVDA/` — 財報分析儀表板、DCF 估值模型、投資論點
  - `AMD/` — 財報分析儀表板
  - `ARM/` — 財報分析儀表板
  - `TSMC/` — 可比公司分析
- **`tw-stock-pre-analyze/`** — 台股每日盤前分析
- **`us-stock-pre-analyze/`** — 美股每日盤前分析
- **`skills/`** — 自製 skill:`earnings-analysis-dashboard`(財報分析儀表板產生器)、`git-publish`(git 發布規範,所有自動排程共用)
- **`schedules/`** — 自動排程任務的正式定義(真實來源),詳見該目錄 `README.md`
- **`finance-mcp/`** — 本機 MCP bridge(`finance-local` 外掛):跑在 Mac 本機,把 TWSE／FRED／Stooq／yfinance／MOPS 等免費資料源與本機 git 工具(commit/push/fetch/pull/publish)接進 Claude,供排程抓一手資料並自動發布到 GitHub。安裝與工具清單見 `finance-mcp/plugin/README.md`。(`node_modules` 不納入版控)

## 線上瀏覽

啟用 GitHub Pages 後,可透過下列網址瀏覽財報觀察日曆首頁:

> https://yuhuan183.github.io/FinanceAssistant/

## 免責聲明

本專案內容為公開資料彙整與個人研究觀點,**不構成投資建議,亦不保證準確性**。所有投資決策應自行評估風險並諮詢合格專業人士。
