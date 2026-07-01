// One command: `npm run dev`.
// Backend = Node.js (Express) server whose algorithms are C++ loaded as a native
// addon. This script makes sure the addon + deps are built, then runs the Node
// backend and the Next.js frontend together with prefixed logs and clean exit.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const BACKEND_PORT = 8080;
const FRONTEND_PORT = 3000;

const color = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const prefix = (label, code) => (chunk) => {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.length) console.log(`${color(code, `[${label}]`)} ${line}`);
  }
};

function run(cmd, args, label) {
  console.log(color("1", `▶ ${label} ...`));
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(color("31", `✖ ${label} failed.`));
    process.exit(1);
  }
}

// 1. Backend: install deps + build the C++ native addon if needed.
const addon = "backend/build/Release/ratelimiter.node";
if (!existsSync("backend/node_modules")) {
  run("npm", ["install", "--prefix", "backend"], "Installing backend deps + building C++ addon");
} else if (!existsSync(addon)) {
  run("npm", ["run", "build", "--prefix", "backend"], "Building C++ addon");
}

// 2. Frontend: install deps if needed.
if (!existsSync("frontend/node_modules")) {
  run("npm", ["install", "--prefix", "frontend"], "Installing frontend deps");
}

// 3. Launch both servers.
const backend = spawn("node", ["backend/server.js"], {
  env: { ...process.env, PORT: String(BACKEND_PORT) },
});
const frontend = spawn("npm", ["run", "dev"], {
  cwd: "frontend",
  env: { ...process.env, BACKEND_URL: `http://localhost:${BACKEND_PORT}` },
});

backend.stdout.on("data", prefix("backend", "36")); // cyan
backend.stderr.on("data", prefix("backend", "36"));
frontend.stdout.on("data", prefix("frontend", "35")); // magenta
frontend.stderr.on("data", prefix("frontend", "35"));

console.log(
  "\n" +
    color("32", "  ✔ Starting up") +
    "\n" +
    `    Frontend : ${color("4", `http://localhost:${FRONTEND_PORT}`)}  (Next.js — open this)\n` +
    `    Backend  : ${color("4", `http://localhost:${BACKEND_PORT}`)}  (Node + C++ addon, proxied via Next)\n` +
    color("90", "    Next.js may take a few seconds on first start. Press Ctrl+C to stop both.\n")
);

// 4. Tie lifetimes together.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(color("90", "\n■ Shutting down ..."));
  backend.kill("SIGINT");
  frontend.kill("SIGINT");
  setTimeout(() => process.exit(0), 300);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

backend.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(color("31", `✖ backend exited (code ${code}). Stopping frontend.`));
    frontend.kill("SIGINT");
    process.exit(code ?? 1);
  }
});
frontend.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(color("31", `✖ frontend exited (code ${code}). Stopping backend.`));
    backend.kill("SIGINT");
    process.exit(code ?? 1);
  }
});
