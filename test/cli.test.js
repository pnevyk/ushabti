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

test("subcommand help runs without dispatching the command", async () => {
    await run(["pr", "comments", "--help"]);
});

test("confluence subcommands are wired up", async () => {
    await run(["confluence", "download", "--help"]);
    await run(["confluence", "create", "--help"]);
    await run(["confluence", "upload", "--help"]);
    await run(["confluence", "template", "--help"]);
});

test("jira template is wired up", async () => {
    await run(["jira", "template", "--help"]);
});

test("config template is wired up", async () => {
    await run(["config", "template", "--help"]);
});
