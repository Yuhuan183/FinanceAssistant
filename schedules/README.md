# schedules/ — 自動排程任務定義（真實來源）

本目錄保存 Cowork 自動排程任務的**正式定義**。

**Repo 是真實來源（source of truth）。** 要修改排程，請改本目錄的檔案，再執行同步，
而不是直接編輯實際的 live 排程。如此可確保「git repo 內容」與「實際在跑的排程」一致。

## 結構

每個排程一個子目錄，內含一個 `task.md`：

- frontmatter：`taskId`、`description`、`cronExpression`、`enabled`
- 內文：排程每次執行時的完整 prompt

目前排程：

| 目錄 | 說明 | 排程時間 | cron |
| --- | --- | --- | --- |
| `tw-stock-pre-market-analysis/` | 台股盤前分析 | 每日 08:30 | `30 8 * * *` |
| `us-stock-pre-market-analysis/` | 美股盤前分析 | 每日 20:30 | `30 20 * * *` |

## 同步（repo → live 排程）— 手動

要把本目錄的定義套用到實際排程，請 Claude 執行「同步排程」，步驟：

1. 對每個 `schedules/<id>/task.md`，讀取 frontmatter 與內文。
2. 呼叫 `update_scheduled_task`，帶入：
   - `taskId` ← frontmatter 的 `taskId`
   - `prompt` ← 檔案內文（frontmatter 以下的全部內容）
   - `cronExpression` ← frontmatter 的 `cronExpression`
   - `description` ← frontmatter 的 `description`
3. 用 `list_scheduled_tasks` 確認 live 排程已更新。

live 排程的實體儲存在 `/Users/zack/Documents/Claude/Scheduled/<id>/SKILL.md`（由排程系統
管理，cron 另外保存）。**請勿直接編輯該處** —— 一律改本目錄的 `task.md` 再同步，
否則 repo 與 live 會不一致。

## git 操作

所有排程的發布步驟皆遵循 `skills/git-publish/SKILL.md`，沙箱環境務必走該 skill 的
`/tmp` clone 流程。
