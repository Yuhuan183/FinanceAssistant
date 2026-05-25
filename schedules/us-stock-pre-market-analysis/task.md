---
taskId: us-stock-pre-market-analysis
description: 在美國股市開盤前, 依據目前美國與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀與個人化分析.
cronExpression: "30 20 * * *"
enabled: true
---

在美國股市開盤前, 依據目前美國與全球市場資訊籌碼動向與用戶個人持股, 給出完整資訊解讀與個人化分析。

產出為自帶樣式、可離線開啟的互動式 HTML 儀表板（繁體中文），涵蓋全球市場、美股籌碼、個人持股盤前快評、多角度分析（持有者／買方／長期投資人）、情境劇本與風險清單。內容為資訊整理與分析觀點，多空並陳，不下買賣指令，務必含免責聲明。歸檔至 `/Users/zack/Documents/Claude/Projects/FinanceAssistant/us-stock-pre-analyze/美股盤前分析_YYYY-MM-DD.html`。

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
4. 將線上網址 `https://yuhuan0216.github.io/FinanceAssistant/` 回報，告知日曆已可點進今日盤前分析。

若 session 未連接專案資料夾，先用 request_cowork_directory 連接 `/Users/zack/Documents/Claude/Projects/FinanceAssistant`。此為自動排程、使用者不在場：實作細節自行合理判斷並在輸出註明；若 git push 失敗，於輸出說明原因，但不影響報告本身的交付。
