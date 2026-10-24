// Compatibility probe for the dependency upgrade: a synthetic block response,
// not a live model or a test of OmniRoute's injection detector.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const server = http.createServer((req, res) => {
  req.resume();
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { code: "SECURITY_001", message: "Blocked test prompt" } }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-promptfoo-probe-"));
const output = path.join(directory, "results.json");
try {
  const child = spawn(
    process.execPath,
    [
      "node_modules/promptfoo/dist/src/entrypoint.js",
      "eval",
      "-c",
      "promptfooconfig.yaml",
      "--no-cache",
      "--output",
      output,
    ],
    {
      env: {
        ...process.env,
        OMNIROUTE_URL: `http://127.0.0.1:${server.address().port}`,
        OMNIROUTE_API_KEY: "synthetic-test-key",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let log = "";
  child.stdout.on("data", (data) => {
    log += data;
  });
  child.stderr.on("data", (data) => {
    log += data;
  });
  const timer = setTimeout(() => child.kill(), 120000);
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  clearTimeout(timer);
  assert.equal(code, 0, log);
  const result = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(result.results.stats.successes, 2);
  assert.equal(result.results.stats.failures, 0);
  assert.equal(result.results.stats.errors, 0);
  console.log("Promptfoo synthetic 400 SECURITY_001 response: 2/2 passed");
} finally {
  server.close();
  if (fs.existsSync(output)) fs.unlinkSync(output);
  fs.rmdirSync(directory);
}
