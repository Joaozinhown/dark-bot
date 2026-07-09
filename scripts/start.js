const { spawnSync } = require("child_process");

process.env.DATABASE_URL ||= "file:./prisma/darkbot.db";

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

run(npx, ["prisma", "db", "push", "--skip-generate"]);
run(process.execPath, ["build/index.js"]);
