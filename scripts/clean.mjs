import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "packages", "gas", "dist");
rmSync(dist, { recursive: true, force: true });
console.log(`cleaned ${path.relative(root, dist)}`);
