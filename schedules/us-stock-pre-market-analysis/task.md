---
taskId: us-stock-pre-market-analysis
description: 在美國股市開盤前, 依據美國與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀、個人化分析與持股配置買賣分析.
cronExpression: "30 20 * * *"
enabled: true
---

在美國股市開盤前, 依據目前美國與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀、個人化分析與持股配置／買賣分析。

產出為自帶樣式、可離線開啟的互動式 HTML 儀表板（繁體中文），涵蓋：全球市場、美股籌碼、個人持股盤前快評、**持股比重與曝險分析**、**多因子題材評分**、**持股配置與買賣分析**、多角度分析（持有者／買方／長期投資人）、情境劇本與風險清單。務必含免責聲明，並聲明本人非財務顧問或證券分析師。歸檔至 `/Users/zack/Documents/Claude/Projects/FinanceAssistant/us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html`。

## 資料來源優先順序（必守）

**優先呼叫本機 MCP 工具 `mcp__finance-local__*`（finance-mcp-bridge）**，比 WebSearch 抓的「公開資料近似值」更權威可審計：

- 個股／ETF 報價 → `stooq_quote`（NVDA／AMD／GOOGL／QQQ／SMH／VOO／VT 等）
- 全球指數（S&P／Dow／Nasdaq／SOX）→ `stooq_quote` 或 `stooq_preset us-indices`（S&P 走 SPY 等 ETF proxy）
- 美國利率、油價、DXY、通膨 → `fred_series` 或 `fred_macro_dashboard`
- US ETF 穿透成分 → `yf_holdings`（受 Yahoo 429 影響時 fallback）
- 加權指數（背景觀察）→ `twse_taiex`

工具不可用時（使用者 Mac 離線、ToolSearch 找不到 `mcp__finance-local__*`）才退回 **WebSearch**，並於報告中註明「資料來源：WebSearch 公開資料近似值」。**資料來源在報告免責聲明中應明確標出**：使用 MCP 時標「Stooq / FRED 等官方／第一手」，使用 WebSearch 時標「公開資料近似值」。

## 個人持股

以 auto-memory 中最新同步的實際美股持股清單為準（持股已於 2026-05-25 同步，記憶檔 `us-stock-holdings`：個股 NVDA／AMD／GOOGL ＋ ETF QQQ／SMH／VOO／VT；ARM 已出清、未持有 TSMC）。**請勿再以財報歸檔推定持股。** 若記憶與使用者最新提供者不一致，以使用者最新提供者為準，並更新記憶。如使用者尚未提供成本價，損益／報酬類分析從略並註明，改以「市值權重」為基礎。

**隱私規範（必守）：本報告發布於公開的 GitHub Pages，個人持股一律以「權重百分比、倍數、或淨資產＝100 的相對基準」呈現，整份報告不得出現絕對持股金額、股數、單一部位市值或投資組合總額。收盤價、ETF 規模等公開市場資料不在此限。**

## 持股比重與曝險分析（必做）

1. **權重比重**：計算各部位佔組合的權重百分比，彙整成總覽表——僅列權重百分比，不列股數與絕對金額。
2. **ETF 穿透曝險（look-through）**：估算 QQQ／SMH／VOO／VT 等 ETF 內含的個股與產業權重，加總出組合對單一個股（特別是 NVDA／AMD／GOOGL）與單一產業（半導體、AI、科技）的「真實」曝險，以百分比或「淨資產＝100」的相對基準呈現，點出帳面分散與實際集中度的落差、ETF 之間的重疊度。ETF 成分權重為估算值，須於報告中註明。
3. **集中度與避震評估**：說明組合的集中風險、是否缺乏防禦性／非美／非科技資產。

## 多因子題材評分（必做）

針對主要持股與當前題材，就「基本面動能 × 估值位階 × 技術位階 × 題材熱度 × 宏觀敏感度」等多項因子做評分或分級，並彙整成總覽表，讓使用者一眼看出各標的在不同因子上的相對強弱。

## 持股配置與買賣分析（必做）

針對使用者每一檔持股，做多因子綜合評估並給出明確方向性建議：

1. **多因子權重評估**：綜合「持股結構 × 市場動向 × 題材／產業趨勢 × 技術面 × 籌碼面 × 估值面」等因子，逐檔說明當前各因子的偏多／偏空訊號。
2. **明確方向建議**：對每檔標的給出明確傾向——**加碼／減碼／中性持有**——並標示**信心評等（高／中／低）**與**觸發條件**（哪些價位、事件或因子變化會改變該建議）。
3. **持股調配建議**：在組合層級提出再平衡方向（哪些部位偏重、建議調整方向、可考慮的權重區間），以情境式呈現（如「若回測 X 價位，分批承接」）。
4. **必要的紀律**：① 每個方向建議都必須同時列出**支撐理由與反方風險／反論點**；② 維持多空並陳，不以單一立場壓過全部觀點；③ 建議為分析觀點，**非具體下單指令**——不指定買賣股數、不催促「立即執行」；④ 對槓桿型 ETF 或高波動標的，須特別提示其風險特性（如槓桿型 ETF 的單日重設與波動耗損）。

## 完成報告後：更新日曆首頁並發布到 GitHub Pages（必做）

FinanceAssistant 專案是 git repo，以 GitHub Pages 發布；repo 根目錄 `index.html` 是財報觀察日曆首頁。完成並歸檔報告後，務必執行：

1. **更新 index.html**：開啟 repo 根目錄 `index.html`，在 `<script>` 內——
   - 於 `PREMARKET` 陣列新增一筆：`{date:'YYYY-MM-DD',label:'美股盤前',file:'us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html'}`（同日期同類別若已存在則更新該筆，勿重複）。
   - 將 `TODAY` 常數更新為報告日期；若報告月份不在 `MONTHS` 陣列中則新增一筆（first＝該月 1 號為星期幾 0–6，days＝當月天數）。
   - 更新標頭副標與頁尾的「更新日」日期。
2. **驗證 index.html**：確認 `<div>`／`</div>` 數量平衡、以 `node --check` 檢查 `<script>` JS 語法、確認新增的 file 相對路徑指向的檔案確實存在。
3. **發布到 GitHub**：依照 repo 內 `skills/git-publish/SKILL.md` 的「標準發布流程（push）」操作。沙箱環境務必走該 skill 的 `/tmp` clone 流程，**切勿**使用 `rm -f .git/index.lock`（沙箱必失敗）。本次要納入版本控制的檔案：
   - `us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html`（今日新報告）
   - `index.html`（已更新）

   commit 訊息：`feat: 美股盤前分析 YYYY-MM-DD`。push 後依該 skill 的「回寫本機 repo」步驟同步本機 refs。切勿在輸出或任何檔案中顯示或記錄 remote URL 內嵌的 token。
4. 將線上網址 `https://yuhuan183.github.io/FinanceAssistant/` 回報，告知日曆已可點進今日盤前分析。

若 session 未連接專案資料夾，先用 request_cowork_directory 連接 `/Users/zack/Documents/Claude/Projects/FinanceAssistant`。此為自動排程、使用者不在場：實作細節自行合理判斷並在輸出註明；若 git push 失敗，於輸出說明原因，但不影響報告本身的交付。
