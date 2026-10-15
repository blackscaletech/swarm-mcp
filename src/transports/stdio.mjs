import { MAX_STDIN_MESSAGE_BYTES } from "../protocol/constants.mjs";

export async function runStdio(server, input = process.stdin, output = process.stdout) {
  const decoder = new TextDecoder("utf8", { fatal: true });
  const frame = Buffer.allocUnsafe(MAX_STDIN_MESSAGE_BYTES);
  let size = 0;
  let discard = false;
  async function finishFrame() {
    if (!discard && size) {
      let line;
      try { line = decoder.decode(frame.subarray(0, size)).trim(); }
      catch { await writeResponse(output, failure(null, -32700, "Parse error")); }
      if (line) await processLine(server, output, line);
    }
    size = 0;
    discard = false;
  }
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    let offset = 0;
    while (offset < bytes.length) {
      const newline = bytes.indexOf(0x0a, offset);
      const end = newline === -1 ? bytes.length : newline;
      if (!discard) {
        if (size + end - offset > MAX_STDIN_MESSAGE_BYTES) {
          size = 0;
          discard = true;
          await writeResponse(output, failure(null, -32600, "Request exceeded the size limit"));
        } else if (end > offset) {
          // One fixed buffer also bounds metadata under one-byte fragmentation.
          bytes.copy(frame, size, offset, end);
          size += end - offset;
        }
      }
      if (newline === -1) break;
      await finishFrame();
      offset = newline + 1;
    }
  }
  await finishFrame();
}

async function processLine(server, output, line) {
  const response = Buffer.byteLength(line, "utf8") > MAX_STDIN_MESSAGE_BYTES
    ? failure(null, -32600, "Request exceeded the size limit")
    : await handleLine(server, line);
  if (response !== null) await writeResponse(output, response);
}

async function writeResponse(output, response) {
  if (output.destroyed || output.writableEnded || output.closed) throw new Error("Swarm protocol output is closed");
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      output.removeListener("drain", onDrain);
      output.removeListener("close", onClose);
      output.removeListener("error", onError);
      if (error) reject(error); else resolve();
    };
    const onDrain = () => finish();
    const onClose = () => finish(new Error("Swarm protocol output is closed"));
    const onError = () => finish(new Error("Swarm protocol output failed"));
    output.once("drain", onDrain);
    output.once("close", onClose);
    output.once("error", onError);
    try { if (output.write(`${JSON.stringify(response)}\n`)) finish(); }
    catch { onError(); }
  });
}

async function handleLine(server, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return failure(null, -32700, "Parse error");
  }
  try {
    return await server.handle(message);
  } catch {
    return failure(message?.id, -32603, "Server error");
  }
}

function failure(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
