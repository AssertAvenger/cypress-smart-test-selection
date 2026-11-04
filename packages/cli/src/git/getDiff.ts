import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Logger } from "../output/logger.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout;
  } catch (error) {
    const detail = error as Error & { stderr?: string };
    throw new Error("Git command failed: " + (detail.stderr?.trim() || detail.message), { cause: error });
  }
}

async function resolveCommit(cwd: string, ref: string): Promise<string> {
  return (await git(cwd, ["rev-parse", "--verify", "--end-of-options", ref + "^{commit}"])).trim();
}

export async function detectBaseBranch(cwd: string): Promise<string> {
  for (const ref of ["origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    try { await resolveCommit(cwd, ref); return ref; } catch { /* Try the next known default branch. */ }
  }
  throw new Error("Cannot detect a base branch. Pass --base <ref> and fetch that ref first.");
}

/** Net changes from merge-base to the current worktree, including untracked files. */
export async function getGitDiff(base: string | undefined, logger: Logger, cwd: string) {
  const repoRoot = (await git(cwd, ["rev-parse", "--show-toplevel"])).replace(/\r?\n$/, "");
  const baseRef = base ?? await detectBaseBranch(repoRoot);
  const baseCommit = await resolveCommit(repoRoot, baseRef);
  let mergeBase: string;
  try {
    mergeBase = (await git(repoRoot, ["merge-base", baseCommit, "HEAD"])).trim();
  } catch (error) {
    throw new Error("Cannot find a merge base with " + baseRef +
      ". Fetch sufficient Git history (including the target branch) before selecting tests.", { cause: error });
  }
  if (await git(repoRoot, ["ls-files", "--unmerged", "-z"])) {
    throw new Error("Resolve merge conflicts before selecting tests.");
  }
  logger.debug("Comparing worktree with merge-base " + mergeBase + " (" + baseRef + ")");
  const [tracked, untracked] = await Promise.all([
    git(repoRoot, ["diff", "--name-status", "-z", "--no-ext-diff", "--no-textconv", "--find-renames", mergeBase, "--"]),
    git(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const additions = untracked.split("\0").filter(Boolean).map((path) => "A\0" + path + "\0").join("");
  return { rawDiff: tracked + additions, repoRoot, baseRef };
}
