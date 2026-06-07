/**
 * git.mjs — 本機 git 操作（status / commit / push / fetch / pull / publish）。
 *
 * 設計重點：
 * - 跑在使用者 Mac 本機（由 Claude Desktop 啟動的 MCP server），因此有正常網路與
 *   ~/.ssh 金鑰，可直連 GitHub —— 沙箱做不到的事在這裡做。
 * - 一律用 execFile + 參數陣列呼叫 git，不經過 shell，避免注入。
 * - 絕不 force push（不接受 --force）；GIT_TERMINAL_PROMPT=0 避免卡在認證輸入。
 * - 回傳純物件，由 server.mjs 的 handler 以 ok()/err() 包裝。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const pexec = promisify(execFile);
const GIT_TIMEOUT = Number(process.env.GIT_TIMEOUT_MS || 120000);
const AUTHOR = [
  '-c', 'user.name=Yuhuan',
  '-c', 'user.email=lfm85768@gmail.com',
];

function assertRepo(repo) {
  if (!repo || typeof repo !== 'string') throw new Error('repo (絕對路徑) 為必填');
  if (!existsSync(join(repo, '.git'))) throw new Error(`不是 git repo（找不到 .git）：${repo}`);
}

/** 執行一個 git 子指令；永不 throw，回 { code, stdout, stderr, argv }。 */
async function git(repo, args, { timeoutMs = GIT_TIMEOUT } = {}) {
  const argv = ['-C', repo, ...args];
  try {
    const { stdout, stderr } = await pexec('git', argv, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return { code: 0, stdout: (stdout || '').trimEnd(), stderr: (stderr || '').trimEnd() };
  } catch (e) {
    return {
      code: typeof e.code === 'number' ? e.code : 1,
      stdout: (e.stdout || '').trimEnd(),
      stderr: (e.stderr || e.message || '').trimEnd(),
    };
  }
}

async function currentBranch(repo) {
  const r = await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.code === 0 ? r.stdout.trim() : null;
}

/** 工作區/分支狀態 + 與上游的 ahead/behind。 */
export async function status(repo) {
  assertRepo(repo);
  const branch = await currentBranch(repo);
  const porcelain = await git(repo, ['status', '--porcelain=v1', '--branch']);
  const remotes = await git(repo, ['remote', '-v']);
  let ahead = null, behind = null;
  const ab = await git(repo, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']);
  if (ab.code === 0) {
    const [b, a] = ab.stdout.split(/\s+/).map(Number);
    behind = b ?? null; ahead = a ?? null;
  }
  const dirty = porcelain.stdout
    .split('\n')
    .filter(l => l && !l.startsWith('##'));
  return {
    repo, branch,
    ahead, behind,
    clean: dirty.length === 0,
    changes: dirty,
    has_remote: remotes.stdout.trim().length > 0,
    branch_line: porcelain.stdout.split('\n')[0] || '',
  };
}

/**
 * 暫存並 commit。files 省略時 = `git add -A`（全部）；給陣列則只加那些路徑。
 * 沒有可提交內容時回 { committed:false, nothing:true }。
 */
export async function commit(repo, { message, files } = {}) {
  assertRepo(repo);
  if (!message || typeof message !== 'string') throw new Error('message（commit 訊息）為必填');
  if (files && (!Array.isArray(files) || files.some(f => typeof f !== 'string')))
    throw new Error('files 須為字串陣列');

  const add = files && files.length
    ? await git(repo, ['add', '--', ...files])
    : await git(repo, ['add', '-A']);
  if (add.code !== 0) return { committed: false, step: 'add', ...add };

  const staged = await git(repo, ['diff', '--cached', '--name-only']);
  if (staged.code === 0 && staged.stdout.trim() === '')
    return { committed: false, nothing: true, message: '無變更可提交（working tree clean）' };

  const c = await git(repo, [...AUTHOR, 'commit', '-m', message]);
  if (c.code !== 0) return { committed: false, step: 'commit', ...c };

  const head = await git(repo, ['rev-parse', '--short', 'HEAD']);
  const stat = await git(repo, ['show', '--stat', '--oneline', '-s', 'HEAD']);
  return {
    committed: true,
    commit: head.stdout.trim(),
    files_staged: staged.stdout.split('\n').filter(Boolean),
    summary: stat.stdout,
  };
}

/** push 到遠端（預設 origin + 目前分支）。永不 force。 */
export async function push(repo, { remote = 'origin', branch } = {}) {
  assertRepo(repo);
  const br = branch || await currentBranch(repo);
  if (!br || br === 'HEAD') throw new Error('無法判定目前分支，請指定 branch');
  const r = await git(repo, ['push', remote, `HEAD:${br}`]);
  return {
    pushed: r.code === 0,
    remote, branch: br,
    code: r.code,
    stdout: r.stdout, stderr: r.stderr,
    hint: r.code === 0
      ? '已推送'
      : /non-fast-forward|fetch first|rejected/i.test(r.stderr)
        ? '遠端有新 commit，先 git_pull（rebase）再 push'
        : /Permission denied|publickey|authenticate/i.test(r.stderr)
          ? 'SSH 認證失敗，確認金鑰已加到 GitHub 帳號'
          : 'push 失敗，見 stderr',
  };
}

/** fetch（預設 origin，--prune）。 */
export async function fetch(repo, { remote = 'origin', prune = true } = {}) {
  assertRepo(repo);
  const args = ['fetch', remote];
  if (prune) args.push('--prune');
  const r = await git(repo, args);
  return { fetched: r.code === 0, remote, code: r.code, stdout: r.stdout, stderr: r.stderr };
}

/** pull（預設 origin + 目前分支 + --rebase）。 */
export async function pull(repo, { remote = 'origin', branch, rebase = true } = {}) {
  assertRepo(repo);
  const br = branch || await currentBranch(repo);
  if (!br || br === 'HEAD') throw new Error('無法判定目前分支，請指定 branch');
  const args = ['pull'];
  if (rebase) args.push('--rebase');
  args.push(remote, br);
  const r = await git(repo, args);
  return {
    pulled: r.code === 0,
    remote, branch: br, rebase,
    code: r.code, stdout: r.stdout, stderr: r.stderr,
    hint: r.code === 0 ? '已更新' : /conflict/i.test(r.stdout + r.stderr) ? 'rebase 衝突，需手動解決' : 'pull 失敗，見 stderr',
  };
}

/** 便利組合：add + commit + push 一次完成。 */
export async function publish(repo, { message, files, remote = 'origin', branch } = {}) {
  const c = await commit(repo, { message, files });
  if (!c.committed && !c.nothing) return { ok: false, stage: 'commit', commit: c };
  const p = await push(repo, { remote, branch });
  return { ok: p.pushed, commit: c, push: p };
}
