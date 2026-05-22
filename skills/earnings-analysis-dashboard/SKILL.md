---
name: earnings-analysis-dashboard
description: Analyze a public company's quarterly earnings report and produce a professional interactive HTML dashboard covering the financial summary, future outlook, valuation, stock-price/technical analysis, and multi-angle investor perspectives. Use when the user asks to analyze, review, or break down a company's earnings or quarterly results (e.g. "幫我分析 NVDA 2027 Q1 財報", "analyze Apple's latest earnings", "財報分析", "earnings analysis", "quarterly results review"), especially when they want a dashboard, visual report, or in-depth write-up. Output is a self-contained .html dashboard.
---

# 財報分析互動式儀表板

針對單一上市公司的某一季財報，產出一份自帶樣式、可離線開啟的互動式 HTML 儀表板。儀表板分五頁：總覽、財報細節、未來展望、股價與估值、三角度投資觀點。

## 重要原則

- **先研究、後製作**：必須先完成資料蒐集，才開始填模板。不要在資料不全時就動工。
- **官方來源優先**：以公司財報新聞稿／SEC 8-K 為準，媒體報導僅作補充與交叉查核。
- **不是投資建議**：提供事實與訊號供使用者自行判斷，多空並陳，不下「買進／賣出」指令。儀表板務必含免責聲明。
- **面對使用者用繁體中文**。

## 工作流程

### 1. 釐清需求

確認標的公司與財報季別。若使用者未指定，或需求模糊，用 AskUserQuestion 詢問。注意會計年度與日曆年可能不同步（如 NVIDIA、Apple）——若使用者要求的季度財報尚未發布，先告知並確認。

預設產出為互動式 HTML 儀表板；若使用者想要其他格式（Word／PDF），改用對應技能。

### 2. 蒐集資料

依 `references/analysis-framework.md` 第 1 節的清單，用 WebSearch / web_fetch（或已連接的金融資料 MCP）蒐集：財報核心數據（本季／上一季／去年同期）、各分部營收、財測、股東回報、法說會引述、分析師反應、股價與估值、技術價位。

逐項交叉查核；不同來源數字有出入時以官方財報為準。

### 3. 建立儀表板

1. 將 `assets/dashboard_template.html` 複製到工作目錄。
2. 將所有 `{{雙大括號}}` 佔位符與 `[示意]` 內容，替換為實際財報數據與分析。
3. CSS 與 `<script>` 的分頁／圖表框架原樣沿用；圖表只需替換 `labels` 與 `data` 陣列。
4. 五頁內容深度應大致平均。各分頁的詳細內容、三角度與多空框架、情境分析方法，見 `references/analysis-framework.md` 第 2–5 節。
5. 數字單位依使用者所在地調整（面對中文使用者可輔以「億」）。

### 4. 驗證（必做）

依 `references/analysis-framework.md` 第 6 節逐項驗證，最關鍵的兩項：

- **div 平衡**：`<div>` 與 `</div>` 數量相等、逐行深度不為負、檔末歸零。未閉合的 div 會讓後面的分頁被吞進前一頁而完全看不到內容。
- **JS 語法**：用 `node --check` 檢查 `<script>` 內容。

另須重算所有成長率、占比、估值倍數，確認數字一致；確認分部營收加總合理、免責聲明存在、措辭無「保證」「必漲」等不當用語。

### 5. 交付

將儀表板存到使用者的工作資料夾，用 present_files 呈現，並附一段簡短的核心結論摘要。完成後可主動詢問是否要設定下季財報日自動更新。
