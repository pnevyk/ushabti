import { test } from "node:test";
import assert from "node:assert/strict";
import { requireKeys, resolveAtlassian, mergeConfig } from "../src/shared/config.js";
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

test("mergeConfig overrides top-level keys", () => {
    const merged = mergeConfig({ github: { token: "global" } }, { github: { token: "local" } });
    assert.deepEqual(merged, { github: { token: "local" } });
});

test("mergeConfig deep-merges nested tables instead of replacing them wholesale", () => {
    const merged = mergeConfig(
        { atlassian: { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "global-tok" } },
        { atlassian: { token: "local-tok" } },
    );
    assert.deepEqual(merged, { atlassian: { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "local-tok" } });
});

test("mergeConfig recurses into doubly-nested tables like confluence.plugins", () => {
    const merged = mergeConfig(
        { confluence: { plugins: { mermaid: "mermaid" } } },
        { confluence: { plugins: { mermaid: "uml" } } },
    );
    assert.deepEqual(merged, { confluence: { plugins: { mermaid: "uml" } } });
});

test("mergeConfig keeps base-only and override-only sections", () => {
    const merged = mergeConfig({ github: { token: "g" } }, { jira: { storyPointsField: "customfield_1" } });
    assert.deepEqual(merged, { github: { token: "g" }, jira: { storyPointsField: "customfield_1" } });
});

test("mergeConfig with an empty override returns the base's values", () => {
    const merged = mergeConfig({ github: { token: "g" } }, {});
    assert.deepEqual(merged, { github: { token: "g" } });
});
