import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { write, ensureDir, subTarget, pathTarget } from "../src/shared/output/file.js";

async function captureStdout(fn) {
    const chunks = [];
    const stub = mock.method(process.stdout, "write", (chunk, cb) => {
        chunks.push(chunk);
        cb?.();
        return true;
    });
    try {
        await fn();
    } finally {
        stub.mock.restore();
    }
    return chunks.join("");
}

test("write to stdout prints the content and ignores name", async () => {
    const out = await captureStdout(() => write({ kind: "stdout" }, "hello\n", "ignored.md"));
    assert.equal(out, "hello\n");
});

test("write to stdout appends a missing trailing newline", async () => {
    const out = await captureStdout(async () => {
        await write({ kind: "stdout" }, "one");
        await write({ kind: "stdout" }, "two\n");
    });
    assert.equal(out, "one\ntwo\n");
});

test("write to a path target writes the file itself", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        await write(pathTarget(join(dir, "a.md")), "content");
        assert.equal(await readFile(join(dir, "a.md"), "utf8"), "content");
    } finally {
        await rm(dir, { recursive: true });
    }
});

test("write to a path target with a name writes inside that directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        await write(pathTarget(dir), "content", "b.md");
        assert.equal(await readFile(join(dir, "b.md"), "utf8"), "content");
    } finally {
        await rm(dir, { recursive: true });
    }
});

test("subTarget joins onto a path target and leaves stdout alone", () => {
    assert.deepEqual(subTarget(pathTarget("out"), "sub"), { kind: "path", path: join("out", "sub") });
    assert.deepEqual(subTarget({ kind: "stdout" }, "sub"), { kind: "stdout" });
});

test("ensureDir creates a path target's directory and is a no-op for stdout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        await ensureDir(pathTarget(join(dir, "x", "y")));
        await write(pathTarget(join(dir, "x", "y")), "ok", "f.md");
        await ensureDir({ kind: "stdout" });
    } finally {
        await rm(dir, { recursive: true });
    }
});
