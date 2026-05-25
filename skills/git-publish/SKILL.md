---
name: git-publish
description: FinanceAssistant 專案的 git 操作規範 — 在 Cowork 沙箱中安全地 pull / commit / push，以及本機 repo 的健康檢查與修復。所有自動排程要發布到 GitHub Pages 時都應遵循本規範。
---

# git-publish — FinanceAssistant git 發布規範

本 skill 規範 FinanceAssistant 專案的所有 git 操作。專案是 git repo，遠端
`github.com/Yuhuan0216/FinanceAssistant`，透過 GitHub Pages 發布；repo 根目錄
`index.html` 為網站首頁。所有自動排程（盤前分析等）在發布前都應讀並遵循本規範。

## 兩種執行環境

做法依環境不同，務必先判斷自己在哪：

- **在使用者自己的 Mac（終端機 / Fork GUI）** — 一般 git，沒有任何限制。
  `git pull` / `git add` / `git commit` / `git push` 照常使用即可，下方「沙箱」章節不適用。
- **在 Cowork 沙箱（自動排程或 Claude 協助作業）** — 專案資料夾以 FUSE 掛載，
  **封鎖 unlink syscall**：任何 `rm`（即使是刪自己剛建立的檔）都會回
  `Operation not permitted`。git 每次寫入會留下無法刪除的 `*.lock` 檔，卡死後續指令。
  **務必遵循下方沙箱流程。**

## 核心原則（沙箱）

1. **絕不用 `rm` 刪 `.git` 內的檔案。** `rm -f .git/index.lock` 之類指令必定失敗，
   改用 `mv` 搬移。
2. **清鎖檔只能搬到 `refs/` 樹之外。** 把 `*.lock` 搬進 `.git/locktrash/`。
   **切勿** `mv x.lock x.lock.bak`：若該檔位於 `refs/` 下（如
   `refs/remotes/origin/main.lock`），改名後仍留在 `refs/` 內，git 會把它當成一個 ref →
   `fatal: bad object`，卡死 `git log` / `fetch` / `fsck`。（2026-05-25 的故障即源於此。）
3. **發布一律走 `/tmp` clone。** `/tmp`、`/var/tmp`、`/dev/shm`、`$HOME` 都支援 unlink，
   git 在那裡完全正常。**不要**在掛載的 repo 內直接 commit。
4. **token 是機密。** remote URL 內嵌細粒度 PAT。**絕不** echo、寫入任何檔案、或在輸出
   顯示 `remote.origin.url`。取用時一律存進 shell 變數（如 `URL=...`），不要印出來。

## 標準發布流程（push）— 沙箱

設 `$REPO` = 掛載的專案資料夾路徑（bash 中通常為
`/sessions/<session>/mnt/FinanceAssistant`，對應 macOS 的
`/Users/zack/Documents/Claude/Projects/FinanceAssistant`）。

```bash
REPO="<掛載專案資料夾路徑>"

# 1. 取得內嵌 PAT 的 remote URL（存進變數，勿 echo）
URL="$(git -C "$REPO" config --get remote.origin.url)"

# 2. 從 GitHub 全新 clone 到 /tmp（這就是遠端最新狀態，且 /tmp 的 unlink 正常）
rm -rf /tmp/fa-pub
git clone -q "$URL" /tmp/fa-pub

# 3. 把本次要發布的檔案，從掛載 repo 複製進 clone。
#    掛載工作區的「檔案內容」是最新的，只有它的 .git 不可靠 —— 所以複製檔案、不複製 .git。
#    保留目錄結構，逐一複製本次新增/修改的檔，例如：
mkdir -p "/tmp/fa-pub/$(dirname '<相對路徑>')"
cp "$REPO/<相對路徑>" "/tmp/fa-pub/<相對路徑>"
#    若有要刪除的檔，在 clone 內 rm 掉即可（/tmp 可正常 unlink）：
#    rm "/tmp/fa-pub/<要刪除的相對路徑>"

# 4. commit & push
cd /tmp/fa-pub
git add -A
git diff --cached --stat    # 確認暫存區只含預期變更
git -c user.name="Yuhuan" -c user.email="lfm85768@gmail.com" \
    commit -m "<類型>: <說明>"
git push -q origin HEAD:main

# 5. 驗證遠端已更新
git ls-remote "$URL" refs/heads/main

# 6. 清理
cd / && rm -rf /tmp/fa-pub
```

push 成功後 GitHub Pages 會自動重建，網址 `https://yuhuan0216.github.io/FinanceAssistant/`。

### 若 push 被拒（non-fast-forward）

代表遠端在第 2 步 clone 之後又有新 commit。在 `/tmp/fa-pub` 內執行
`git pull --rebase origin main`（/tmp 可正常運作），解決後重新 `git push`。

### 回寫本機 repo（建議，讓掛載 repo 不落後遠端）

push 後，掛載 repo 的本機 `.git` 仍指向舊 commit。建議同步，避免本機 repo 看起來「落後／壞掉」：

```bash
NEW="$(git ls-remote "$URL" refs/heads/main | cut -f1)"

clearlocks() {
  mkdir -p "$REPO/.git/locktrash"
  find "$REPO/.git" -name '*.lock' -type f 2>/dev/null | while read -r f; do
    mv "$f" "$REPO/.git/locktrash/$(echo "$f" | tr / _).$RANDOM" 2>/dev/null
  done
}

clearlocks
git -C "$REPO" fetch -q origin   # 下載新物件（ref 更新會失敗無妨，物件會進 .git/objects）
clearlocks
printf '%s\n' "$NEW" > "$REPO/.git/refs/heads/main"
printf '%s\n' "$NEW" > "$REPO/.git/refs/remotes/origin/main"
git -C "$REPO" reset -q          # 讓 index 對齊新的 HEAD
clearlocks
git -C "$REPO" log --oneline -1  # 驗證
```

**順序很重要：先 `fetch` 下載物件，再改 ref。** 若只改 ref 卻沒 fetch，`.git/objects`
缺少該 commit 物件，`git log` 會報 `bad object`，反而把本機 repo 弄壞。

## 取得最新（pull）— 沙箱

沙箱要取得遠端最新內容，最可靠的就是上面第 1–2 步的 `/tmp` clone —— clone 出來的就是遠端
最新狀態。若要把最新內容更新回掛載工作區，從 `/tmp/fa-pub` 把檔案 `cp` 回 `$REPO`，
再依「回寫本機 repo」步驟同步 refs。

## commit 訊息規範

格式：`<類型>: <繁體中文說明>`。類型用詞：

- `feat:` — 新報告、新內容、新功能
- `fix:` — 修正錯誤
- `docs:` — 文件、README
- `chore:` — 設定、目錄結構、雜務
- `refactor:` — 重構、改名

範例：`feat: 台股盤前分析 2026-05-25`、`chore: 新增 git 發布規範 skill`。

## git 健康檢查與修復

排程或協作時若 git 行為異常，先在掛載 repo 自我診斷：

```bash
git -C "$REPO" symbolic-ref HEAD       # 應為 refs/heads/main
git -C "$REPO" status                  # 應顯示「On branch main」
find "$REPO/.git/refs" -type f         # refs/ 下不應有 *.lock 或奇怪的檔
```

常見故障與修法：

- **HEAD 指向不存在的分支**（如 `refs/heads/master`，`git status` 顯示
  "No commits yet"、整個工作區被當成全新檔）：
  `printf 'ref: refs/heads/main\n' > "$REPO/.git/HEAD"`（`>` 覆寫不需 unlink，可行）。
- **`refs/` 下有壞掉的 ref**（0-byte 檔、`*.lock.xxx` 等，git 報 `bad object`）：
  用 `mv` 把它搬到 `.git/locktrash/`（搬出 `refs/` 樹）。
- **殘留 `*.lock`**：用上方 `clearlocks` 函式搬走。
- 修完後執行 `git -C "$REPO" reset -q` 加 `clearlocks` 讓 index 對齊，再 `git log` 驗證。

修復時只動 `.git` 內部指標（HEAD、refs、index），**不要**碰 commit 歷史與 `objects`；
資料本身通常完好無損。
