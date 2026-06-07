/**
 * 極簡 .env 載入器(零相依)。
 * MCP server 由 Claude 啟動時不一定帶入 shell 環境變數,故在啟動最早期
 * 把 finance-mcp/.env 的 KEY=VALUE 讀進 process.env(不覆蓋既有值)。
 * 必須是 server.mjs 的「第一個 import」,確保之後的模組讀得到 key。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env'); // finance-mcp/.env

try {
  const txt = readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue; // 跳過註解(# ...)與空行
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
} catch {
  // 沒有 .env 檔就略過(改由 .mcp.json 的 env 或 shell 提供)
}
