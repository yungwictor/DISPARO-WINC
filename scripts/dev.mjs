import { spawn } from "node:child_process";

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "pipe",
    env: { ...process.env }
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (code) console.error(`[${name}] finalizado com codigo ${code}`);
  });

  return child;
}

const backend = start("api", "npm", ["run", "dev"], "backend");
const frontend = start("web", "npm", ["run", "dev"], "frontend");

function shutdown() {
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
