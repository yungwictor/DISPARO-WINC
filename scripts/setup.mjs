import { spawnSync } from "node:child_process";

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("npm", ["install"]);
run("npm", ["install"], "backend");
run("npm", ["install"], "frontend");

console.log("\nDISPARO WINC instalado.");
console.log("Use: npm run dev");
