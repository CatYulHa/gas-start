#!/usr/bin/env node
/**
 * One-shot bootstrap:  npm run setup
 *
 *   1. Google login (clasp login — opens a browser; token cached in ~/.clasprc.json)
 *   2. Check that the Apps Script API is enabled for the account (opens the
 *      settings page and waits if it is not)
 *   3. Create a new Spreadsheet + bound Apps Script project  (skipped if already set up)
 *   4. Build the TypeScript backend and the React dashboard
 *   5. Push to Apps Script
 *   6. Deploy as a web app (creates or updates the deployment)
 *   7. Open the web app — the "Hello, GasStart" dashboard
 *
 * Options:
 *   --env <name>        environment file to use (default: dev)
 *   --type <type>       sheets (default) | standalone | docs | slides | forms
 *   --title <title>     project title (default: "GasStart Demo (<env>)")
 *   --no-open           don't open the browser at the end
 *   --dry-run           print the steps without running anything
 */
import { existsSync } from "node:fs";
import {
  APPS_SCRIPT_SETTINGS_URL,
  appsScriptApiStatus,
  claspAccessToken,
  ensureEnvFile,
  envFileFor,
  isInteractive,
  liveFile,
  openInBrowser,
  parseJsonOutput,
  promptEnter,
  readEnvConfig,
  readJson,
  rel,
  removeLiveFile,
  runClasp,
  runNpm,
  sleep,
  syncLiveFile,
  urls,
  writeEnvConfig,
} from "./lib.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: npm run setup [-- --env dev --type sheets --title "My App" --no-open --dry-run]`);
  process.exit(0);
}
const env = valueOf("--env") ?? "dev";
const type = valueOf("--type") ?? "sheets";
const title = valueOf("--title") ?? `GasStart Demo (${env})`;
const open = !args.includes("--no-open");
const dryRun = args.includes("--dry-run");

const TOTAL = 7;
let stepNo = 0;
const step = (msg) => console.log(`\n\x1b[1m[${++stepNo}/${TOTAL}] ${msg}\x1b[0m`);
const note = (msg) => console.log(`      ${msg}`);
const warn = (msg) => console.log(`      \x1b[33m${msg}\x1b[0m`);
const opts = { label: env };

// ---------------------------------------------------------------- 1. login
step("Google login");
if (dryRun) {
  note("would run: clasp show-authorized-user → clasp login (browser) if not logged in");
} else {
  const who = runClasp(["show-authorized-user"], { ...opts, capture: true, quiet: true });
  if (who.status !== 0 || /not logged in/i.test(who.stdout + who.stderr)) {
    note("Not logged in — a browser window will open. Sign in with the Google account that should own the demo.");
    runClasp(["login"], opts);
  } else {
    note(`Already logged in: ${who.stdout.trim().split("\n")[0]}`);
  }
}

// --------------------------------------------------- 2. Apps Script API check
step("Apps Script API enabled for this account?");
if (dryRun) {
  note(`would probe script.googleapis.com; if disabled, open ${APPS_SCRIPT_SETTINGS_URL} and wait`);
} else {
  await ensureAppsScriptApi();
}

// -------------------------------------------------------- 3. create project
step(`Apps Script project (${env})`);
if (ensureEnvFile(env)) note(`Created ${rel(envFileFor(env))} from the template.`);
let config = readEnvConfig(env);

if (config.scriptId) {
  note(`Using existing scriptId ${config.scriptId} from ${rel(envFileFor(env))}.`);
} else if (dryRun) {
  note(`would run: clasp create-script --type ${type} --title "${title}" --rootDir dist`);
} else {
  config = await createProject(config);
}

// ---------------------------------------------------------------- 4. build
step("Build (dashboard → dist/index.html, backend → dist/Code.js)");
if (dryRun) note("would run: npm run build");
else runNpm("build");

// ----------------------------------------------------------------- 5. push
step("Push to Apps Script");
if (dryRun) {
  note("would run: clasp push -f");
} else {
  syncLiveFile(config);
  runClasp(["push", "-f"], opts);
}

// --------------------------------------------------------------- 6. deploy
step("Deploy as web app");
if (dryRun) {
  note(config.deploymentId ? `would run: clasp update-deployment ${config.deploymentId}` : "would run: clasp create-deployment");
} else if (config.deploymentId) {
  runClasp(["update-deployment", config.deploymentId, "-d", `setup ${new Date().toISOString()}`], opts);
  note(`Updated deployment ${config.deploymentId}.`);
} else {
  const { status, stdout, stderr } = runClasp(["--json", "create-deployment", "-d", "GasStart initial deployment"], {
    ...opts,
    capture: true,
  });
  if (status !== 0) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    fail("clasp create-deployment failed.");
  }
  const deploymentId = parseJsonOutput(stdout)?.deploymentId;
  if (!deploymentId) {
    process.stdout.write(stdout);
    fail("Could not read the deploymentId from clasp output.");
  }
  config = { ...config, deploymentId };
  writeEnvConfig(env, config);
  note(`Created deployment ${deploymentId} (saved — future deploys update it in place).`);
}

// ------------------------------------------------------------------ 7. open
step("Done — your links");
const webUrl = config.deploymentId ? urls.webApp(config.deploymentId) : "(deploy first)";
const shipCmd = ["dev", "prod"].includes(env)
  ? `npm run ship:${env}     push + deploy in one go`
  : `npm run push:${env}, then npm run deploy:${env}`;
console.log(`
  Web app   : ${webUrl}
  Editor    : ${config.scriptId ? urls.editor(config.scriptId) : "-"}
  ${config.parentId ? `Sheet     : ${urls.container(config.parentId)}` : "Sheet     : set Script Property SPREADSHEET_ID (standalone script)"}

  First visit: Google asks you (the deployer, once) to authorize the script and warns
  "Google hasn't verified this app" — that is normal for unverified OAuth apps:
  Advanced → "Go to ${title} (unsafe)" → Allow. Visitors never see this screen.
  Then click "Load sample data" in the dashboard to fill the \`data\` sheet with demo rows.
  Details: docs/deploy.md §6

  Sharing: the web app is private to you (webapp.access = MYSELF). To open it up, edit
  "webapp" in packages/gas/appsscript.json and run ${shipCmd}:
    everyone in your Workspace domain  → executeAs USER_DEPLOYING, access DOMAIN
    only people the sheet is shared with → executeAs USER_ACCESSING, access ANYONE
  Details: docs/deploy.md §7

  Next steps
    npm run dev            edit the React dashboard locally with mock data
    npm run push:${env}      rebuild + upload after changing packages/gas or packages/dashboard
    npm run deploy:${env}    publish a new version to the same web-app URL
    ${shipCmd}
    cd python && gasstart-sheets auth    (optional) pandas ETL into the sheet
`);

if (open && !dryRun && config.deploymentId) {
  runClasp(["open-web-app", config.deploymentId], { ...opts, quiet: true });
}

// ------------------------------------------------------------------ helpers

/**
 * The Apps Script API has a per-user on/off switch that is OFF by default.
 * Every clasp command that touches a script fails until it is on, so check
 * first, open the settings page, and wait for the user instead of failing later.
 */
async function ensureAppsScriptApi() {
  const token = await claspAccessToken();
  if (!token) {
    warn("No fresh clasp token to probe with; skipping the check (the create step retries if the API is off).");
    return;
  }

  let status = await appsScriptApiStatus(token);
  if (status === "enabled") return note("Enabled.");
  if (status === "unknown") return warn("Could not reach script.googleapis.com; continuing anyway.");

  console.log(`
      The Google Apps Script API is turned OFF for this account (Google's default).
      Opening the settings page — flip the toggle to ON, then come back here:
        ${APPS_SCRIPT_SETTINGS_URL}
`);
  openInBrowser(APPS_SCRIPT_SETTINGS_URL);

  if (!isInteractive()) {
    fail(`Enable the Apps Script API at ${APPS_SCRIPT_SETTINGS_URL} and run \`npm run setup\` again.`);
  }

  for (;;) {
    const answer = await promptEnter("      Press Enter once the toggle is ON (q to quit): ");
    if (/^q(uit)?$/i.test(answer)) fail("Aborted. Run `npm run setup` again after enabling the API.");

    // Google can take a minute to propagate the change — poll a few times before asking again.
    for (let attempt = 1; attempt <= 6; attempt++) {
      status = await appsScriptApiStatus(token);
      if (status !== "disabled") return note("Enabled — thanks!");
      if (attempt < 6) {
        note(`Still reporting disabled (attempt ${attempt}/6) — waiting 10s for Google to propagate the change…`);
        await sleep(10_000);
      }
    }
    warn("Still disabled after a minute. Make sure the toggle is ON for the same account you logged in with.");
  }
}

/** clasp create-script, with a retry loop for the API-propagation window. */
async function createProject(config) {
  const rootDir = config.rootDir || "dist";
  for (let attempt = 1; ; attempt++) {
    removeLiveFile(); // clasp refuses to create when .clasp.json exists
    const { status, stdout, stderr } = runClasp(
      ["--json", "create-script", "--type", type, "--title", title, "--rootDir", rootDir],
      { ...opts, capture: true, quiet: attempt > 1 },
    );
    if (status === 0) {
      const created = parseJsonOutput(stdout) ?? {};
      const fromLive = existsSync(liveFile) ? readJson(liveFile) : {};
      const scriptId = created.scriptId ?? fromLive.scriptId;
      const parentId = created.parentId ?? fromLive.parentId;
      if (!scriptId) {
        process.stdout.write(stdout);
        fail("Could not read the new scriptId from clasp output.");
      }
      const next = { ...config, scriptId, rootDir };
      if (parentId) next.parentId = parentId;
      writeEnvConfig(env, next);
      note(`Created ${type === "sheets" ? "a new Spreadsheet with a bound" : `a ${type}`} script "${title}".`);
      note(`scriptId ${scriptId} saved to ${rel(envFileFor(env))}.`);
      return next;
    }

    const output = stdout + stderr;
    if (/has not enabled the Apps Script API/i.test(output) && attempt <= 6) {
      note(`Apps Script API not ready yet (attempt ${attempt}/6) — retrying in 10s…`);
      await sleep(10_000);
      continue;
    }
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    fail(
      /has not enabled the Apps Script API/i.test(output)
        ? `The Apps Script API is still disabled. Turn it on at ${APPS_SCRIPT_SETTINGS_URL} and run \`npm run setup\` again.`
        : "clasp create-script failed (see output above).",
    );
  }
}

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}

function fail(message) {
  console.error(`\n\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}
