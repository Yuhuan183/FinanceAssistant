---
taskId: tw-stock-pre-market-analysis
description: 在台灣股市開盤前, 依據台灣與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀、個人化分析與持股配置買賣分析.
cronExpression: "30 8 * * *"
enabled: true
---

在台灣股市開盤前, 依據目前台灣與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀、個人化分析與持股配置／買賣分析。

產出為自帶樣式、可離線開啟的互動式 HTML 儀表板（繁體中文），涵蓋：全球市場、台股籌碼、個人持股盤前快評、**持股配置與買賣分析**、多角度分析（持有者／買方／長期投資人）、情境劇本與風險清單。務必含免責聲明，並聲明本人非財務顧問或證券分析師。歸檔至 `/Users/zack/Documents/Claude/Projects/FinanceAssistant/tw-stock-pre-analyze/台股盤前分析_YYYY-MM-DD.html`。

## 個人持股

以 auto-memory 中最新同步的實際台股持股清單為準（持股已於 2026-05-25 同步，記憶檔 `tw-stock-holdings`）。若記憶與使用者最新提供者不一致，以使用者最新提供者為準，並更新記憶。如使用者尚未提供成本價，損益／報酬類分析從略並註明。

## 持股配置與買賣分析（必做）

針對使用者每一檔持股，做多因子綜合評估並給出明確方向性建議：

1. **多因子權重評估**：綜合「持股結構 × 市場動向 × 題材／產業趨勢 × 技術面 × 籌碼面 × 估值面」等因子，逐檔說明當前各因子的偏多／偏空訊號。
2. **明確方向建議**：對每檔標的給出明確傾向——**加碼／減碼／中性持有**——並標示**信心評等（高／中／低）**與**觸發條件**（哪些價位、事件或因子變化會改變該建議）。
3. **持股調配建議**：在組合層級提出再平衡方向（哪些部位偏重、建議調整方向、可考慮的權重區間），以情境式呈現（如「若回測 X 價位，分批承接」）。
4. **必要的紀律**：① 每個方向建議都必須同時列出**支撐理由與反方風險／反論點**；② 維持多空並陳，不以單一立場壓過全部觀點；③ 建議為分析觀點，**非具體下單指令**——不指定買賣張數、不催促「立即執行」；④ 槓桿型 ETF（如 00631L、00663L）須特別提示單日槓桿重設與波動耗損（volatility decay）風險。

## 完成報告後：更新日曆首頁並發布到 GitHub Pages（必做）

FinanceAssistant 專案是 git repo，以 GitHub Pages 發布；repo 根目錄 `index.html` 是財報觀察日曆首頁。完成並歸檔報告後，務必執行：

1. **更新 index.html**：開啟 repo 根目錄 `index.html`，在 `<script>` 內——
   - 於 `PREMARKET` 陣列新增一筆：`{date:'YYYY-MM-DD',label:'台股盤前',file:'tw-stock-pre-analyze/台股盤前分析_YYYY-MM-DD.html'}`（同日期同類別若已存在則更新該筆，勿重複）。
   - 將 `TODAY` 常數更新為報告日期；若報告月份不在 `MONTHS` 陣列中則新增一筆（first＝該月 1 號為星期幾 0–6，days＝當月天數）。
   - 更新標頭副標與頁尾的「更新日」日期。
2. **驗證 index.html**：確認 `<div>`／`</div>` 數量平衡、以 `node --check` 檢查 `<script>` JS 語法、確認新增的 file 相對路徑指向的檔案確實存在。
3. **發布到 GitHub**：依照 repo 內 `skills/git-publish/SKILL.md` 的「標準發布流程（push）」操作。沙箱環境務必走該 skill 的 `/tmp` clone 流程，**切勿**使用 `rm -f .git/index.lock`（沙箱必失敗）。本次要納入版本控制的檔案：
   - `tw-stock-pre-analyze/台股盤前分析_YYYY-MM-DD.html`（今日新報告）
   - `index.html`（已更新）

   commit 訊息：`feat: 台股盤前分析 YYYY-MM-DD`。push 後依該 skill 的「回寫本機 repo」步驟同步本機 refs。切勿在輸出或任何檔案中顯示或記錄 remote URL 內嵌的 token。
4. 將線上網址 `https://yuhuan0216.github.io/FinanceAssistant/` 回報，告知日曆已可點進今日盤前分析。

若 session 未連接專案資料夾，先用 request_cowork_directory 連接 `/Users/zack/Documents/Claude/Projects/FinanceAssistant`。此為自動排程、使用者不在場：實作細節自行合理判斷並在輸出註明；若 git push 失敗，於輸出說明原因，但不影響報告本身的交付。
