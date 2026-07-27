import { test } from "node:test";
import assert from "node:assert/strict";
import { requireKeys, resolveAtlassian } from "../src/shared/config.js";
import { CliError } from "../src/shared/errors.js";

const config = { github: { token: "t" }, jira: { baseUrl: "u", email: "", token: "a" } };

test("requireKeys passes when keys present", () => {
    assert.equal(requireKeys(config, ["github.token", "jira.baseUrl"]), config);
});

test("requireKeys throws on missing or empty keys", () => {
    assert.throws(() => requireKeys(config, ["jira.email"]), CliError);
    assert.throws(() => requireKeys(config, ["jira.nope"]), CliError);
});

test("resolveAtlassian prefers the [atlassian] section", () => {
    const resolved = resolveAtlassian({
        atlassian: { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "tok" },
        jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" },
    });
    assert.deepEqual(resolved, { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "tok" });
});

test("resolveAtlassian falls back to [jira] when [atlassian] is absent", () => {
    const resolved = resolveAtlassian({
        jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" },
    });
    assert.deepEqual(resolved, { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" });
});

test("resolveAtlassian falls back per-field for a partially migrated config", () => {
    const resolved = resolveAtlassian({
        atlassian: { baseUrl: "https://acme.atlassian.net" },
        jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" },
    });
    assert.deepEqual(resolved, { baseUrl: "https://acme.atlassian.net", email: "old@acme.com", token: "oldtok" });
});

test("resolveAtlassian throws naming missing atlassian.* keys", () => {
    assert.throws(() => resolveAtlassian({}), CliError);
    assert.throws(() => resolveAtlassian({ atlassian: { baseUrl: "u" } }), (err) => {
        return err instanceof CliError && err.message.includes("atlassian.email") && err.message.includes("atlassian.token");
    });
});
