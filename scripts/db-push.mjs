import { existsSync, mkdirSync, readFileSync } from "node:fs";
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result;
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL 未设置。");
  process.exit(1);
}

if (!databaseUrl.startsWith("file:")) {
  const result = spawnSync("npx", ["prisma", "db", "push"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 0);
}

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const rawDbPath = databaseUrl.slice("file:".length);
const dbPath = rawDbPath.startsWith("/")
  ? rawDbPath
  : path.resolve(process.cwd(), "prisma", rawDbPath);

mkdirSync(path.dirname(dbPath), { recursive: true });

const existingTables = existsSync(dbPath)
  ? run("sqlite3", [dbPath, ".tables"]).stdout.trim()
  : "";

if (existingTables) {
  console.log(`SQLite 数据库已存在，跳过建表引导：${dbPath}`);
  process.exit(0);
}

const sql = run("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  schemaPath,
  "--script",
], {
  shell: process.platform === "win32",
}).stdout;

run("sqlite3", [dbPath], { input: sql });
console.log(`SQLite schema 已初始化：${dbPath}`);

const generateResult = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(generateResult.status ?? 0);
