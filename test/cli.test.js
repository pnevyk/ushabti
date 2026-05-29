import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/cli/index.js";
import { CliError } from "../src/shared/errors.js";

test("unknown command throws CliError", async () => {
    await assert.rejects(() => run(["foo", "bar"]), CliError);
});

test("help runs without error", async () => {
    await run(["--help"]);
});
