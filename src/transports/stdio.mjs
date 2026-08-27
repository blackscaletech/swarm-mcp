import { once } from "node:events";
import { StringDecoder } from "node:string_decoder";
import { MAX_STDIN_MESSAGE_BYTES } from "../protocol/constants.mjs";

export async function runStdio(server, input = process.stdin, output = process.stdout) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  for await (const chunk of input) {
    buffer += decoder.write(chunk);
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) await processLine(server, output, line);
      newline = buffer.indexOf("\n");
    }
    if (Buffer.byteLength(buffer, "utf8") > MAX_STDIN_MESSAGE_BYTES) {
      await writeResponse(output, failure(null, -32600, "Request exceeded the size limit"));
      buffer = "";
    }
  }
  buffer += decoder.end();
  const finalLine = buffer.trim();
  if (finalLine) await processLine(server, output, finalLine);
}

async function processLine(server, output, line) {
  const response = Buffer.byteLength(line, "utf8") > MAX_STDIN_MESSAGE_BYTES
    ? failure(null, -32600, "Request exceeded the size limit")
    : await handleLine(server, line);
  if (response !== null) await writeResponse(output, response);
}

async function writeResponse(output, response) {
  if (!output.write(`${JSON.stringify(response)}\n`)) await once(output, "drain");
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
