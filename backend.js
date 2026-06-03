import { execFileSync } from "node:child_process";

const method = process.argv[2] || "";
const root = process.argv[3] || "";
const input = await readInput();

try {
  if (!root) throw new Error("workspace root is required");
  if (method === "history") respond({ status: gitStatus(root), commits: gitHistory(root, input.limit || 30) });
  else if (method === "commit") respond(gitCommit(root, input.hash || ""));
  else throw new Error(`unknown method: ${method}`);
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function respond(value) {
  process.stdout.write(JSON.stringify(value));
}

function git(rootPath, args) {
  return execFileSync("git", args, { cwd: rootPath, encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
}

function gitStatus(rootPath) {
  const branch = git(rootPath, ["branch", "--show-current"]).trim() || "detached";
  const status = git(rootPath, ["status", "--porcelain=v1", "-z"]).split("\0").filter(Boolean);
  return { branch, dirty: status.length };
}

function gitHistory(rootPath, limit) {
  const count = Math.min(Math.max(Number(limit) || 30, 1), 180);
  const log = git(rootPath, ["log", `-${count}`, "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e"]);
  return log.split("\x1e").map((row) => row.trim()).filter(Boolean).map((row) => {
    const [hash, shortHash, authorName, date, refs, subject] = row.split("\x1f");
    const files = changedFiles(rootPath, hash);
    const additions = files.reduce((sum, file) => sum + file.additions, 0);
    const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
    return { hash, shortHash, authorName, date, refs: parseRefs(refs), subject, files, additions, deletions };
  });
}

function gitCommit(rootPath, hash) {
  if (!/^[0-9a-fA-F]{7,40}$/.test(hash)) throw new Error("commit hash is required");
  const [commit] = gitHistoryForHash(rootPath, hash);
  if (!commit) throw new Error("commit not found");
  const body = git(rootPath, ["show", "--format=%B", "--no-patch", hash]).trim();
  const diff = git(rootPath, ["show", "--format=", "--find-renames", "--patch", "--stat", hash]);
  return { commit, body, diff, truncated: false };
}

function gitHistoryForHash(rootPath, hash) {
  const log = git(rootPath, ["log", "-1", "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e", hash]);
  return log.split("\x1e").map((row) => row.trim()).filter(Boolean).map((row) => {
    const [fullHash, shortHash, authorName, date, refs, subject] = row.split("\x1f");
    const files = changedFiles(rootPath, fullHash);
    return {
      hash: fullHash,
      shortHash,
      authorName,
      date,
      refs: parseRefs(refs),
      subject,
      files,
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    };
  });
}

function changedFiles(rootPath, hash) {
  const output = git(rootPath, ["show", "--format=", "--numstat", "--name-status", "--find-renames", hash]);
  const statuses = {};
  const files = [];
  for (const line of output.split("\n").filter(Boolean)) {
    const parts = line.split("\t");
    if (/^[AMDRC]/.test(parts[0])) {
      const path = parts.length > 2 ? parts[2] : parts[1];
      statuses[path] = statusName(parts[0]);
      continue;
    }
    if (parts.length >= 3) {
      const path = parts.length > 3 ? parts[3] : parts[2];
      files.push({
        path,
        oldPath: parts.length > 3 ? parts[2] : "",
        status: statuses[path] || "modified",
        additions: count(parts[0]),
        deletions: count(parts[1]),
      });
    }
  }
  return files;
}

function statusName(code) {
  if (code.startsWith("A")) return "added";
  if (code.startsWith("D")) return "deleted";
  if (code.startsWith("R")) return "renamed";
  return "modified";
}

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRefs(value) {
  return String(value || "").split(",").map((ref) => ref.trim()).filter(Boolean);
}
