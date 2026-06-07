---
taskId: us-stock-pre-market-analysis
description: 平日晚上 8 點, 美股盤前 + 台股盤後收盤回顧 + 全球股市走向解讀, 依市場籌碼動向與個人持股給出完整資訊解讀、個人化分析與持股配置買賣分析.
cronExpression: "0 20 * * 1-5"
enabled: true
---

平日（週一至週五）台灣時間晚上 8 點執行：美股即將開盤，台股當日已收盤。請以「美股盤前 + 台股盤後（收盤回顧）+ 全球股市走向解讀」三大主軸，依據目前美國、台灣與全球市場資訊、籌碼動向與用戶個人持股，給出完整資訊解讀、個人化分析與持股配置／買賣分析。

產出為自帶樣式、可離線開啟的互動式 HTML 儀表板（繁體中文），涵蓋：**全球股市走向解讀**（亞歐股市當日收盤、美股期指、匯率與商品、宏觀事件）、**台股盤後重點**（加權當日收盤、三大法人籌碼、持股相關個股表現）、**美股盤前**（持股相關個股盤前報價與夜間消息、當日財報/經濟數據行程）、個人持股盤前快評、**持股比重與曝險分析**、**多因子題材評分**、**持股配置與買賣分析**、**價位支撐／壓力與目標價分析（含具體價位與操作建議）**、多角度分析（持有者／買方／長期投資人）、情境劇本與風險清單。務必含免責聲明，並聲明本人非財務顧問或證券分析師。歸檔至 `/Users/siegfried/WorkSpace/FinanceAssistant/us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html`。

## 資料來源優先順序（必守）

**一律優先呼叫本機 MCP `mcp__finance-local__*`（官方／可審計），WebSearch 僅為最後退路。** 各類資料的精準優先序：

**美股（盤前報價／前收，已改用 Twelve Data 官方 key，最高優先）**
- 個股與 ETF（NVDA／AMD／GOOGL／QQQ／SOXX／SOXQ／VOO／VT、台積電 ADR 用 `TSM`）→ **`td_quotes`（一次批次抓完，勿逐檔 `td_quote`）**
- 四大指數與費半／VIX（S&P／Dow／Nasdaq／SOX／VIX）→ **`td_preset us-indices`**（回 ETF proxy：SPY／DIA／QQQ／SOXX／VIXY，**% 漲跌貼近指數、點位非指數本身，報告須標示 proxy**）
- ⚠️ **免費版 8 次/分上限**：務必用批次工具（`td_quotes`／`td_preset`），整份報告控制在少數幾次批次內、必要時間隔呼叫，避免 429。
- 備援：`stooq_quote`（反爬時自動退回 Twelve Data）；`yf_*` 因 Yahoo 429 已不可靠，不要依賴。
- US ETF 穿透成分（QQQ／SOXX／SOXQ／VOO／VT）→ `yf_holdings`；受 Yahoo 429 影響時改用記憶中已知權重或 WebSearch，並註明為估算。

**宏觀（FRED 官方 API）**
- 美國利率／油價／DXY／通膨 → `fred_series`／`fred_multi`／`fred_macro_dashboard`
- ⚠️ **FRED 日資料延遲約 1 個交易日**：當日最新值若 FRED 尚無，改用 Twelve Data（油價 `td_quote WTI/USD`）或 WebSearch 並標明近似。

**台股盤後（第一手官方）**
- 當日收盤 → `twse_taiex`；三大法人 → `twse_three_institutional`；個股 → `twse_stock`

**退路與標註**
- 僅當上述 MCP 全數失效才退回 **WebSearch**，並於報告標「資料來源：WebSearch 公開資料近似值」。
- **免責聲明須逐類標來源**：Twelve Data（指數為 ETF proxy）／FRED 官方 API／TWSE 官方／WebSearch 近似值，分別標清楚。

## 個人持股

以 auto-memory 中最新同步的實際美股持股清單為準（持股已於 2026-06-04 同步，記憶檔 `us-stock-holdings`：個股 NVDA／AMD／GOOGL ＋ ETF QQQ／SOXX／SOXQ／VOO／VT；ARM 已出清、未持有 TSMC；SMH 已於 2026-06-04 全數換成 SOXX＋SOXQ）。**請勿再以財報歸檔推定持股。** 若記憶與使用者最新提供者不一致，以使用者最新提供者為準，並更新記憶。如使用者尚未提供成本價，損益／報酬類分析從略並註明，改以「市值權重」為基礎。

**隱私規範（必守）：本報告發布於公開的 GitHub Pages，個人持股一律以「權重百分比、倍數、或淨資產＝100 的相對基準」呈現，整份報告不得出現絕對持股金額、股數、單一部位市值或投資組合總額。收盤價、ETF 規模等公開市場資料不在此限。**

## 持股比重與曝險分析（必做）

1. **權重比重**：計算各部位佔組合的權重百分比，彙整成總覽表——僅列權重百分比，不列股數與絕對金額。
2. **ETF 穿透曝險（look-through）**：估算 QQQ／SOXX／SOXQ／VOO／VT 等 ETF 內含的個股與產業權重，加總出組合對單一個股（特別是 NVDA／AMD／GOOGL）與單一產業（半導體、AI、科技）的「真實」曝險，以百分比或「淨資產＝100」的相對基準呈現，點出帳面分散與實際集中度的落差、ETF 之間的重疊度。**注意 SOXX 與 SOXQ 同追蹤費城半導體指數、成分高度重疊（彼此近乎等價），穿透時須視為高度相關、避免重複計入而低估半導體集中度。** ETF 成分權重為估算值，須於報告中註明。
3. **集中度與避震評估**：說明組合的集中風險、是否缺乏防禦性／非美／非科技資產。

## 多因子題材評分（必做）

針對主要持股與當前題材，就「基本面動能 × 估值位階 × 技術位階 × 題材熱度 × 宏觀敏感度」等多項因子做評分或分級，並彙整成總覽表，讓使用者一眼看出各標的在不同因子上的相對強弱。

## 持股配置與買賣分析（必做）

針對使用者每一檔持股，做多因子綜合評估並給出明確方向性建議：

1. **多因子權重評估**：綜合「持股結構 × 市場動向 × 題材／產業趨勢 × 技術面 × 籌碼面 × 估值面」等因子，逐檔說明當前各因子的偏多／偏空訊號。
2. **明確方向建議**：對每檔標的給出明確傾向——**加碼／減碼／中性持有**——並標示**信心評等（高／中／低）**與**觸發條件**（哪些價位、事件或因子變化會改變該建議）。
3. **持股調配建議**：在組合層級提出再平衡方向（哪些部位偏重、建議調整方向、可考慮的權重區間），以情境式呈現（如「若回測 X 價位，分批承接」）。
4. **必要的紀律**：① 每個方向建議都必須同時列出**支撐理由與反方風險／反論點**；② 維持多空並陳，不以單一立場壓過全部觀點；③ 建議為分析觀點，**非具體下單指令**——不指定買賣股數、不催促「立即執行」；④ 對槓桿型 ETF 或高波動標的，須特別提示其風險特性（如槓桿型 ETF 的單日重設與波動耗損）。

## 價位支撐／壓力與目標價分析（必做）

針對**主要指數（S&P 500／Nasdaq／費半 SOX）與每一檔持股（NVDA／AMD／GOOGL 及各 ETF）**，給出**具體價位數值與其依據**，不得只給方向或形容詞：

1. **支撐／壓力價位**：逐標的列出 1–2 道支撐與 1–2 道壓力價位（數值），並標明依據——前一日收盤、盤前報價、整數關卡、均線（50 日／200 日，估算須註明）、近期波段高低點與 52 週高低。
2. **目標價／估值錨**：核心個股（NVDA／AMD／GOOGL）須附**分析師目標價區間並標明來源**，以及本益比／估值錨，說明現價相對目標價與 52 週區間的位置；ETF 以近期區間＋整數關推算支撐。
3. **操作建議（3–5 條）**：每條建議務必同時含「**明確動作（附參考價位區間）＋ 依據理由 ＋ 反方風險**」三要素；維持多空並陳；建議為分析觀點，**非下單指令**，不指定買賣股數、不催促立即執行；對槓桿型或高波動標的須提示其風險特性。
4. 所有價位為**盤前參考座標、非預測**；估算值（均線、ETF 成分、盤前報價）須明確標示為估算。

## 完成報告後：更新日曆首頁並發布到 GitHub Pages（必做）

FinanceAssistant 專案是 git repo，以 GitHub Pages 發布；repo 根目錄 `index.html` 是財報觀察日曆首頁。完成並歸檔報告後，務必執行：

1. **更新 index.html**：開啟 repo 根目錄 `index.html`，在 `<script>` 內——
   - 於 `PREMARKET` 陣列新增一筆：`{date:'YYYY-MM-DD',label:'美股盤前',file:'us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html'}`（同日期同類別若已存在則更新該筆，勿重複）。
   - 將 `TODAY` 常數更新為報告日期；若報告月份不在 `MONTHS` 陣列中則新增一筆（first＝該月 1 號為星期幾 0–6，days＝當月天數）。
   - 更新標頭副標與頁尾的「更新日」日期。
2. **驗證 index.html**：確認 `<div>`／`</div>` 數量平衡、以 `node --check` 檢查 `<script>` JS 語法、確認新增的 file 相對路徑指向的檔案確實存在。
3. **發布到 GitHub（優先用本機 git 工具）**：呼叫 finance-local MCP 工具 `git_publish`（在 Mac 本機 add+commit+push，用本機 SSH 金鑰、無需 token）：
   - `repo`：`/Users/siegfried/WorkSpace/FinanceAssistant`
   - `files`：`["us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html", "index.html"]`
   - `message`：`feat: 美股盤前分析 YYYY-MM-DD`

   若 `git_publish` 回 non-fast-forward（遠端有新 commit），先呼叫 `git_pull`（`repo` 同上、`rebase:true`）再 `git_push`。**退路**：若 finance-local git 工具不可用（Mac 離線／未連 MCP），改走 `skills/git-publish/SKILL.md` 的沙箱 `/tmp` clone 流程；該情境 push 可能失敗，於輸出註明「需使用者本機 push」即可，不影響報告交付。
4. 將線上網址 `https://yuhuan183.github.io/FinanceAssistant/` 回報，告知日曆已可點進今日盤前分析。

若 session 未連接專案資料夾，先用 request_cowork_directory 連接 `/Users/siegfried/WorkSpace/FinanceAssistant`。此為自動排程、使用者不在場：實作細節自行合理判斷並在輸出註明；若 git push 失敗，於輸出說明原因，但不影響報告本身的交付。
