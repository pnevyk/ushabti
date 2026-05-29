import { test } from "node:test";
import assert from "node:assert/strict";
import { requireKeys } from "../src/shared/config.js";
import { CliError } from "../src/shared/errors.js";

const config = { github: { token: "t" }, jira: { baseUrl: "u", email: "", token: "a" } };

test("requireKeys passes when keys present", () => {
    assert.equal(requireKeys(config, ["github.token", "jira.baseUrl"]), config);
});

test("requireKeys throws on missing or empty keys", () => {
    assert.throws(() => requireKeys(config, ["jira.email"]), CliError);
    assert.throws(() => requireKeys(config, ["jira.nope"]), CliError);
});
