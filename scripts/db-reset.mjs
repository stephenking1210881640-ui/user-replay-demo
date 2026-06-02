import { existsSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL 未设置。");
  process.exit(1);
}

if (!databaseUrl.startsWith("file:")) {
  console.error("当前 DATABASE_URL 指向远程数据库，已拒绝执行 db:reset。");
  process.exit(1);
}

const rawDbPath = databaseUrl.slice("file:".length);
const dbPath = rawDbPath.startsWith("/")
  ? rawDbPath
  : path.resolve(process.cwd(), "prisma", rawDbPath);

if (existsSync(dbPath)) {
  rmSync(dbPath);
}

const result = spawnSync("npm", ["run", "db:setup"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 0);
