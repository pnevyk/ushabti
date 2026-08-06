import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { writeErrorLog } from "../src/shared/log.js";
import { AuthenticationError } from "../src/shared/errors.js";

test("writeErrorLog writes to the system temp directory and returns the path", () => {
    const err = new AuthenticationError({ service: "github", cause: new Error("Bad credentials") });
    const path = writeErrorLog(err, ["pr", "comments"]);
    try {
        assert.ok(path.startsWith(tmpdir()));
        assert.ok(existsSync(path));
        const contents = readFileSync(path, "utf8");
        assert.match(contents, /Command: ushabti pr comments/);
        assert.match(contents, /GitHub rejected the request/);
    } finally {
        rmSync(path);
    }
});

test("writeErrorLog walks the cause chain, including the original error's stack", () => {
    const cause = new Error("Bad credentials");
    const err = new AuthenticationError({ service: "github", cause });
    const path = writeErrorLog(err, []);
    try {
        const contents = readFileSync(path, "utf8");
        assert.match(contents, /Caused by:/);
        assert.match(contents, /Bad credentials/);
    } finally {
        rmSync(path);
    }
});

test("writeErrorLog handles an error with no cause", () => {
    const err = new AuthenticationError({ service: "github" });
    const path = writeErrorLog(err, []);
    try {
        const contents = readFileSync(path, "utf8");
        assert.ok(!/Caused by:/.test(contents));
    } finally {
        rmSync(path);
    }
});
