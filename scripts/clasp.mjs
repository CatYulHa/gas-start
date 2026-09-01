#!/usr/bin/env node
/**
 * Environment-aware wrapper around clasp.
 *
 *   node scripts/clasp.mjs <env> <command> [...args]
 *
 * <env> is "dev", "prod", or any name you like. It selects
 * packages/gas/.clasp.<env>.json, copies the clasp-relevant fields to
 * packages/gas/.clasp.json (the file clasp actually reads) and then runs
 * clasp inside packages/gas.
 *
 * Friendly commands (everything else is passed through to clasp verbatim):
 *   create [--type sheets|standalone] [--title T]
 *                 clasp create-script — default type "sheets" creates a new
 *                 Spreadsheet with the script bound to it (no SPREADSHEET_ID needed).
 *                 Saves scriptId/parentId back to the env file.
 *   push          clasp push -f
 *   deploy [desc] clasp create-deployment — or update-deployment when the env
 *                 file has "deploymentId" (keeps the web-app URL stable)
 *   open          clasp open-script            (Apps Script editor)
 *   sheet         clasp open-container         (the bound spreadsheet)
 *   web           clasp open-web-app [deploymentId]
 *   status        clasp show-file-status
 *   deployments   clasp list-deployments
 *   versions      clasp list-versions
 *
 * For a one-shot first-time setup use `npm run setup` (scripts/setup.mjs).
 */
import { existsSync } from "node:fs";
import {
  ensureEnvFile,
  envFileFor,
  parseJsonOutput,
  readEnvConfig,
  readJson,
  rel,
  removeLiveFile,
  runClasp,
  syncLiveFile,
  liveFile,
  urls,
  writeEnvConfig,
} from "./lib.mjs";

const [env, cmd, ...rest] = process.argv.slice(2);

if (!env || !cmd) {
  console.error("Usage: node scripts/clasp.mjs <env> <command> [...args]");
  console.error("  e.g. node scripts/clasp.mjs dev push");
  process.exit(1);
}

const envFile = envFileFor(env);

if (!existsSync(envFile)) {
  if (cmd === "create") {
    ensureEnvFile(env);
    console.log(`Created ${rel(envFile)} from the example template.`);
  } else {
    console.error(`Missing ${rel(envFile)}.`);
    console.error(`  Run "npm run setup" (first-time bootstrap) or "npm run create:${env}",`);
    console.error(`  or copy .clasp.example.json to .clasp.${env}.json and fill in an existing scriptId.`);
    process.exit(1);
  }
}

const envConfig = readEnvConfig(env);
const opts = { label: env };

if (cmd === "create") {
  createScript(envConfig, rest);
  process.exit(0);
}

const live = syncLiveFile(envConfig);
if (!live.scriptId) {
  console.error(`scriptId is empty in ${rel(envFile)}. Run "npm run setup" / "npm run create:${env}" or paste an existing scriptId.`);
  process.exit(1);
}

switch (cmd) {
  case "push":
    runClasp(["push", "-f", ...rest], opts);
    break;
  case "deploy": {
    const description = rest.length ? rest.join(" ") : `${env} ${new Date().toISOString()}`;
    if (envConfig.deploymentId) {
      runClasp(["update-deployment", envConfig.deploymentId, "-d", description], opts);
      console.log(`Web app: ${urls.webApp(envConfig.deploymentId)}`);
    } else {
      const { status, stdout, stderr } = runClasp(["--json", "create-deployment", "-d", description], { ...opts, capture: true });
      process.stdout.write(stdout);
      if (status !== 0) {
        process.stderr.write(stderr);
        process.exit(status);
      }
      const deploymentId = parseJsonOutput(stdout)?.deploymentId;
      if (deploymentId) {
        writeEnvConfig(env, { ...envConfig, deploymentId });
        console.log(`Saved deploymentId to ${rel(envFile)} — future "deploy" calls update this deployment in place.`);
        console.log(`Web app: ${urls.webApp(deploymentId)}`);
      }
    }
    break;
  }
  case "open":
    runClasp(["open-script"], opts);
    break;
  case "sheet":
  case "container":
    runClasp(["open-container"], opts);
    break;
  case "web": {
    const id = rest.length ? rest : envConfig.deploymentId ? [envConfig.deploymentId] : [];
    runClasp(["open-web-app", ...id], opts);
    break;
  }
  case "status":
    runClasp(["show-file-status", ...rest], opts);
    break;
  case "deployments":
    runClasp(["list-deployments", ...rest], opts);
    break;
  case "versions":
    runClasp(["list-versions", ...rest], opts);
    break;
  default:
    runClasp([cmd, ...rest], opts);
}

/**
 * clasp create-script refuses to run when .clasp.json already exists, so the
 * live file is removed first; clasp then writes a fresh one which we fold back
 * into the env file.
 */
function createScript(config, args) {
  if (config.scriptId) {
    console.error(`${rel(envFile)} already has scriptId ${config.scriptId}; refusing to create another project.`);
    console.error(`  Delete the scriptId (or the file) if you really want a new script.`);
    process.exit(1);
  }
  const type = valueOf(args, "--type") ?? "sheets";
  const title = valueOf(args, "--title") ?? `GasStart (${env})`;
  const rootDir = config.rootDir || "dist";

  removeLiveFile();
  const { status, stdout, stderr } = runClasp(
    ["--json", "create-script", "--type", type, "--title", title, "--rootDir", rootDir],
    { ...opts, capture: true },
  );
  if (status !== 0) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exit(status);
  }
  const created = parseJsonOutput(stdout) ?? {};
  const fromLive = existsSync(liveFile) ? readJson(liveFile) : {};
  const scriptId = created.scriptId ?? fromLive.scriptId;
  const parentId = created.parentId ?? fromLive.parentId;
  if (!scriptId) {
    process.stdout.write(stdout);
    console.error("Could not determine the new scriptId from clasp output.");
    process.exit(1);
  }
  const next = { ...config, scriptId, rootDir };
  if (parentId) next.parentId = parentId;
  writeEnvConfig(env, next);

  console.log(`Created ${type} script "${title}"`);
  console.log(`  scriptId : ${scriptId}  → saved to ${rel(envFile)}`);
  console.log(`  editor   : ${urls.editor(scriptId)}`);
  if (parentId) console.log(`  container: ${urls.container(parentId)}`);
  return next;
}

function valueOf(args, flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}
