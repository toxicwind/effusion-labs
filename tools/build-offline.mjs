import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "");
const shimPath = path.join(__dirname, "offline-network-shim.cjs");
const eleventyCmd = path.join(projectRoot, "node_modules", "@11ty", "eleventy", "cmd.cjs");

const extraArgs = process.argv.slice(2);
const nodeArgs = ["--require", shimPath, eleventyCmd, ...extraArgs];

const child = spawn(process.execPath, nodeArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    BUILD_OFFLINE: "1",
  },
});

child.on("exit", code => {
  process.exit(code ?? 0);
});
