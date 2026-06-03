import { chmodSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const dir = dirname(fileURLToPath(import.meta.url));
const binary = join(dir, "bin", binaryName());

if (!existsSync(binary)) {
  process.stderr.write(`unsupported or missing git viewer backend binary: ${binary}\n`);
  process.exit(1);
}

try {
  chmodSync(binary, 0o755);
} catch {
  // Best effort: source archives or plugin installers may drop executable bits.
}

const run = spawnSync(binary, process.argv.slice(2), {
  encoding: "utf8",
  input: await readStdin(),
  maxBuffer: 1024 * 1024 * 32,
});

process.stdout.write(run.stdout || "");
process.stderr.write(run.stderr || "");
if (run.error) {
  process.stderr.write(`${run.error.message}\n`);
  process.exit(1);
}
process.exit(run.status ?? 1);

function binaryName() {
  if (process.platform === "win32") return "unsupported-windows";
  const platform = process.platform;
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  if (!["darwin", "linux"].includes(platform) || !["amd64", "arm64"].includes(arch)) {
    return `unsupported-${platform}-${arch}`;
  }
  return `backend-${platform}-${arch}`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
