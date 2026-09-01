/**
 * Shared helpers for scripts/clasp.mjs and scripts/setup.mjs.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const gasDir = path.join(root, "packages", "gas");
export const distDir = path.join(gasDir, "dist");
export const liveFile = path.join(gasDir, ".clasp.json");
export const exampleFile = path.join(gasDir, ".clasp.example.json");

/** Fields clasp itself understands. Anything else in an env file (deploymentId…) is ours. */
export const CLASP_FIELDS = [
  "scriptId",
  "parentId",
  "rootDir",
  "projectId",
  "filePushOrder",
  "scriptExtensions",
  "htmlExtensions",
  "jsonExtensions",
  "fileExtension",
  "skipSubdirectories",
];

export const rel = (file) => path.relative(root, file) || ".";
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

/** Environment names become file names — keep them to a safe charset and never "example". */
export function assertEnvName(env) {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(env) || env === "example") {
    console.error(`Invalid environment name "${env}". Use letters, digits, "-" or "_" (not "example").`);
    process.exit(1);
  }
  return env;
}

export const envFileFor = (env) => path.join(gasDir, `.clasp.${assertEnvName(env)}.json`);

/** Creates .clasp.<env>.json from the example template if missing. Returns true if created. */
export function ensureEnvFile(env) {
  const file = envFileFor(env);
  if (existsSync(file)) return false;
  copyFileSync(exampleFile, file);
  return true;
}

export function readEnvConfig(env) {
  return readJson(envFileFor(env));
}

export function writeEnvConfig(env, config) {
  writeJson(envFileFor(env), config);
}

/** Writes the clasp-visible subset of an env config to packages/gas/.clasp.json. */
export function syncLiveFile(envConfig) {
  const live = {};
  for (const key of CLASP_FIELDS) if (envConfig[key] !== undefined && envConfig[key] !== "") live[key] = envConfig[key];
  if (!live.rootDir) live.rootDir = "dist";
  writeJson(liveFile, live);
  return live;
}

export function removeLiveFile() {
  rmSync(liveFile, { force: true });
}

export function claspBin() {
  // @google/clasp restricts "exports", so package.json cannot be require.resolve'd.
  // Walk up from this repo looking for node_modules/@google/clasp instead.
  let dir = root;
  for (;;) {
    const pkgPath = path.join(dir, "node_modules", "@google", "clasp", "package.json");
    if (existsSync(pkgPath)) {
      const pkg = readJson(pkgPath);
      const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.clasp;
      return path.join(path.dirname(pkgPath), bin);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.error("@google/clasp is not installed. Run `npm install` at the repo root first.");
  process.exit(1);
}

/**
 * Runs clasp in packages/gas.
 * - capture: false → inherit stdio, exit the process on failure
 * - capture: true  → return { status, stdout, stderr } without exiting
 */
export function runClasp(args, { capture = false, label = "", quiet = false } = {}) {
  if (!quiet) console.log(`${label ? `[${label}] ` : ""}clasp ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [claspBin(), ...args], {
    cwd: gasDir,
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (capture) return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (result.status !== 0) process.exit(result.status ?? 1);
  return { status: 0, stdout: "", stderr: "" };
}

/** Runs an npm script at the repo root (inherits stdio, exits on failure). */
export function runNpm(script) {
  if (!/^[a-z][a-z0-9:-]*$/.test(script)) throw new Error(`refusing to run npm script "${script}"`);
  console.log(`npm run ${script}`);
  const result = spawnSync(`npm run ${script}`, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Pulls the first JSON object out of mixed CLI output (spinners, hints…). */
export function parseJsonOutput(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  for (let end = text.lastIndexOf("}"); end > start; end = text.lastIndexOf("}", end - 1)) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

export const urls = {
  editor: (scriptId) => `https://script.google.com/d/${scriptId}/edit`,
  webApp: (deploymentId) => `https://script.google.com/macros/s/${deploymentId}/exec`,
  devWebApp: (scriptId) => `https://script.google.com/macros/s/${scriptId}/dev`,
  container: (parentId) => `https://drive.google.com/open?id=${parentId}`,
};

// ------------------------------------------------------------------ preflight

export const APPS_SCRIPT_SETTINGS_URL = "https://script.google.com/home/usersettings";
const CLASPRC = path.join(homedir(), ".clasprc.json");

/**
 * Reads clasp's cached access token (read-only — this file belongs to clasp and
 * is never modified here). Returns null when not logged in or when the token has
 * expired; callers then skip the preflight and let clasp report problems itself.
 */
export async function claspAccessToken(user = "default") {
  if (!existsSync(CLASPRC)) return null;
  const creds = readJson(CLASPRC).tokens?.[user];
  if (!creds?.access_token) return null;
  if (creds.expiry_date && creds.expiry_date < Date.now() + 30_000) return null;
  return creds.access_token;
}

/**
 * Probes the Apps Script API with a harmless GET. The API answers with a
 * distinctive PERMISSION_DENIED message while the per-user toggle at
 * APPS_SCRIPT_SETTINGS_URL is off; any other answer (404 for the fake id,
 * 200, other 403s) means the API is reachable.
 * @returns {"enabled" | "disabled" | "unknown"}
 */
export async function appsScriptApiStatus(accessToken) {
  try {
    const res = await fetch("https://script.googleapis.com/v1/projects/gasstart-preflight-check", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    if (/has not enabled the Apps Script API/i.test(text)) return "disabled";
    return "enabled";
  } catch {
    return "unknown";
  }
}

/** Opens a URL in the default browser without blocking. */
export function openInBrowser(url) {
  if (!/^https:\/\/[\w.-]+(\/[\w./?=&%-]*)?$/.test(url)) throw new Error(`refusing to open ${url}`);
  // argv form (no shell string) so the URL can never be interpreted as shell syntax
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd.exe", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

export const isInteractive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

export async function promptEnter(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
