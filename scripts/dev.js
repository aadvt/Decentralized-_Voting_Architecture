const net = require("net");
const { spawn } = require("child_process");

function isPortOpen(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
    socket.connect(port, host, () => done(true));
  });
}

async function waitForPort(host, port, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    // eslint-disable-next-line no-await-in-loop
    const open = await isPortOpen(host, port);
    if (open) return true;
    // Small delay (in-process) to avoid busy-loop
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

(async () => {
  const RPC_HOST = "127.0.0.1";
  const RPC_PORT = 7545;
  const WEB_PORT = 8080;
  const MNEMONIC = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

  // If the web server is already running, don't start another one.
  if (await isPortOpen("127.0.0.1", WEB_PORT)) {
    console.error(`Port ${WEB_PORT} is already in use. Close the existing server and retry.`);
    process.exit(1);
  }

  let ganacheProcess;

  const rpcAlreadyRunning = await isPortOpen(RPC_HOST, RPC_PORT);
  if (!rpcAlreadyRunning) {
    console.log(`Starting local chain on http://${RPC_HOST}:${RPC_PORT} ...`);
    const ganacheCmd = [
      "npx ganache",
      `--port ${RPC_PORT}`,
      "--chain.chainId 1337",
      "--chain.networkId 1337",
      `--wallet.mnemonic \"${MNEMONIC}\"`,
    ].join(" ");

    ganacheProcess = spawn(ganacheCmd, {
      stdio: "inherit",
      shell: true,
    });

    const ok = await waitForPort(RPC_HOST, RPC_PORT);
    if (!ok) {
      console.error("Ganache did not start in time.");
      if (ganacheProcess) ganacheProcess.kill();
      process.exit(1);
    }
  } else {
    console.log(`Using existing chain on http://${RPC_HOST}:${RPC_PORT}`);
  }

  try {
    await run("npx", ["truffle", "migrate", "--reset"]);
    await run("npm", ["start"]);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    if (ganacheProcess) {
      ganacheProcess.kill();
    }
  }
})();
