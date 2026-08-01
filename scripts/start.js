const { spawn } = require("child_process");
const { appendFileSync, readFileSync, statSync, writeFileSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const RETAIN_LOG_BYTES = 4 * 1024 * 1024;
const logPath = process.env.DTA_RUNTIME_LOG_PATH || join(tmpdir(), "dark-bot-runtime.log");
process.env.DTA_RUNTIME_LOG_PATH = logPath;
writeFileSync(logPath, `> dark-bot@1.0.0 start\n> node scripts/start.js\n\n`, "utf8");

function appendLog(chunk) {
  appendFileSync(logPath, chunk);
  if (statSync(logPath).size <= MAX_LOG_BYTES) return;
  const current = readFileSync(logPath);
  writeFileSync(logPath, current.subarray(Math.max(0, current.length - RETAIN_LOG_BYTES)));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });
    child.stdout.on("data", chunk => {
      process.stdout.write(chunk);
      appendLog(chunk);
    });
    child.stderr.on("data", chunk => {
      process.stderr.write(chunk);
      appendLog(chunk);
    });
    const signalHandlers = new Map();
    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    };
    child.once("error", error => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      if (signal) return reject(new Error(`${command} encerrado por ${signal}`));
      return code === 0 ? resolve() : reject(Object.assign(new Error(`${command} saiu com codigo ${code}`), { exitCode: code }));
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      const handler = () => child.kill(signal);
      signalHandlers.set(signal, handler);
      process.once(signal, handler);
    }
  });
}

async function main() {
  await run(process.execPath, [join(__dirname, "migrate.js")]);
  await run(process.execPath, ["build/index.js"]);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  const line = `[Start] ${message}\n`;
  process.stderr.write(line);
  appendLog(line);
  process.exit(typeof error.exitCode === "number" ? error.exitCode : 1);
});
