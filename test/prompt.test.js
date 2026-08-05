import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readStdinToEof, promptConfirm } from "../src/shared/prompt.js";

test("readStdinToEof trims a single trailing LF", async () => {
    const result = await readStdinToEof(Readable.from(["secret-value\n"]));
    assert.equal(result, "secret-value");
});

test("readStdinToEof trims a single trailing CRLF", async () => {
    const result = await readStdinToEof(Readable.from(["secret-value\r\n"]));
    assert.equal(result, "secret-value");
});

test("readStdinToEof leaves content with no trailing newline untouched", async () => {
    const result = await readStdinToEof(Readable.from(["secret-value"]));
    assert.equal(result, "secret-value");
});

test("readStdinToEof concatenates multiple chunks before trimming", async () => {
    const result = await readStdinToEof(Readable.from(["sec", "ret-", "value\n"]));
    assert.equal(result, "secret-value");
});

test("promptConfirm answers false without prompting when stdin isn't a TTY", async () => {
    const original = process.stdin.isTTY;
    process.stdin.isTTY = false;
    try {
        assert.equal(await promptConfirm("Delete? [y/N] "), false);
    } finally {
        process.stdin.isTTY = original;
    }
});
