const { spawnSync } = require("child_process");
const { join } = require("path");

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

run(process.execPath, [join(__dirname, "migrate.js")]);
run(process.execPath, ["build/index.js"]);
