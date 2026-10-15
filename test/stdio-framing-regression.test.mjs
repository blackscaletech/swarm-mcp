import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { MAX_STDIN_MESSAGE_BYTES } from "../src/protocol/constants.mjs";
import { runStdio } from "../src/transports/stdio.mjs";

function fixture() {
  const input = new PassThrough();
  const output = new PassThrough();
  const responses = [];
  const calls = [];
  output.on("data", chunk => responses.push(...chunk.toString().trim().split("\n").filter(Boolean).map(JSON.parse)));
  const server = { handle: async message => {
    calls.push(message);
    return { jsonrpc: "2.0", id: message.id, result: {} };
  } };
  return { input, output, responses, calls, server };
}

test("rejects an oversized prefix once and discards its valid-looking suffix", async () => {
  const f = fixture();
  let rejected;
  const rejection = new Promise(resolve => { rejected = resolve; });
  f.output.on("data", () => rejected());
  const running = runStdio(f.server, f.input, f.output);
  f.input.write(Buffer.alloc(MAX_STDIN_MESSAGE_BYTES + 1, 0x78));
  await rejection;
  f.input.end('{"id":1,"method":"forbidden_suffix"}\n{"id":2,"method":"next_frame"}\n');
  await running;
  assert.deepEqual(f.calls.map(message => message.id), [2]);
  assert.equal(f.responses.filter(response => response.error).length, 1);
  assert.equal(f.responses[0].error.code, -32600);
});

test("ignores oversized unterminated suffix at EOF without a second error", async () => {
  const f = fixture();
  const running = runStdio(f.server, f.input, f.output);
  f.input.end(Buffer.concat([Buffer.alloc(MAX_STDIN_MESSAGE_BYTES + 1, 0x78), Buffer.from('{"id":1}') ]));
  await running;
  assert.deepEqual(f.calls, []);
  assert.equal(f.responses.length, 1);
  assert.equal(f.responses[0].error.code, -32600);
});

test("byte-boundary splits retain exact UTF-8 frames and recover after oversized frames", async () => {
  const valid = Buffer.from('{"id":2,"value":"\u00e9\u6f22"}\n');
  const invalid = Buffer.alloc(MAX_STDIN_MESSAGE_BYTES + 1, 0x78);
  for (const split of [1, MAX_STDIN_MESSAGE_BYTES - 1, MAX_STDIN_MESSAGE_BYTES, MAX_STDIN_MESSAGE_BYTES + 1]) {
    const f = fixture();
    const bytes = Buffer.concat([invalid, Buffer.from('\n\n'), valid]);
    const running = runStdio(f.server, f.input, f.output);
    f.input.write(bytes.subarray(0, split));
    await new Promise(resolve => setImmediate(resolve));
    for (const byte of bytes.subarray(split)) f.input.write(Buffer.from([byte]));
    f.input.end();
    await running;
    assert.deepEqual(f.calls, [{ id: 2, value: "\u00e9\u6f22" }]);
    assert.equal(f.responses.filter(response => response.error).length, 1);
  }
});

test("invalid UTF-8 is rejected, not rewritten into executable JSON", async () => {
  const f = fixture();
  const running = runStdio(f.server, f.input, f.output);
  f.input.end(Buffer.concat([Buffer.from('{"id":1,"value":"'), Buffer.from([0xc3, 0x28]),
    Buffer.from('"}\n{"id":2}\n')]));
  await running;
  assert.deepEqual(f.calls.map(message => message.id), [2]);
  assert.equal(f.responses[0].error.code, -32700);
});

test("closed output rejects a backpressured response without waiting forever", async () => {
  const input = new PassThrough();
  const output = new EventEmitter();
  output.write = () => { queueMicrotask(() => output.emit("close")); return false; };
  input.end('{"id":1}\n');
  let timer;
  try {
    await assert.rejects(Promise.race([runStdio({ handle: async () => ({ id: 1, result: {} }) }, input, output),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("audit wait timed out")), 250); })]), /output.*closed/i);
    assert.equal(output.listenerCount("drain"), 0);
    assert.equal(output.listenerCount("close"), 0);
    assert.equal(output.listenerCount("error"), 0);
  } finally { clearTimeout(timer); input.destroy(); }
});

test("aborted input terminates without dispatching a partial frame", async () => {
  const f = fixture();
  const error = new Error("synthetic input aborted");
  const running = runStdio(f.server, f.input, f.output);
  f.input.write('{"id":1');
  f.input.destroy(error);
  await assert.rejects(running, candidate => candidate === error);
  assert.deepEqual(f.calls, []);
});

test("sequential dispatch queues cancellation behind the active tool without hidden concurrency", async () => {
  const f = fixture();
  let entered;
  let finish;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { finish = resolve; });
  f.server.handle = async message => {
    f.calls.push(message.method);
    if (message.method === "long_tool") { entered(); await pending; }
    return message.id ? { id: message.id, result: {} } : null;
  };
  const running = runStdio(f.server, f.input, f.output);
  f.input.write('{"id":1,"method":"long_tool"}\n{"method":"notifications/cancelled"}\n');
  await started;
  assert.deepEqual(f.calls, ["long_tool"]);
  finish();
  f.input.end('{"id":2,"method":"next"}\n');
  await running;
  assert.deepEqual(f.calls, ["long_tool", "notifications/cancelled", "next"]);
  assert.deepEqual(f.responses.map(response => response.id), [1, 2]);
});
