// Runs a command with env files loaded, the first file winning: `node scripts/with-env.mjs a.env b.env -- cmd args`.
// Used for the Base Sepolia scripts, because Next.js refuses Node's --env-file flags in its worker processes.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const split = process.argv.indexOf("--");
if (split === -1 || split === process.argv.length - 1) {
  console.error("Usage: node scripts/with-env.mjs <env files...> -- <command> [args...]");
  process.exit(1);
}
for (const file of process.argv.slice(2, split)) {
  if (!existsSync(file)) {
    console.error(`${file} does not exist`);
    process.exit(1);
  }
  // loadEnvFile never overwrites a variable that is already set, so earlier files take precedence.
  process.loadEnvFile(file);
}
const [command, ...args] = process.argv.slice(split + 1);
const child = spawn(command, args, { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
