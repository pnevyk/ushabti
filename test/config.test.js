import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireKeys, mergeConfig, loadOptionalConfig } from "../src/shared/config.js";
import { CliError } from "../src/shared/errors.js";

const config = { github: { token: "t" }, jira: { baseUrl: "u", email: "", token: "a" } };

test("requireKeys passes when keys present", () => {
    assert.equal(requireKeys(config, ["github.token", "jira.baseUrl"]), config);
});

test("requireKeys throws on missing or empty keys", () => {
    assert.throws(() => requireKeys(config, ["jira.email"]), CliError);
    assert.throws(() => requireKeys(config, ["jira.nope"]), CliError);
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

test("loadOptionalConfig parses an explicit config path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        const file = join(dir, "config.toml");
        await writeFile(file, '[ui]\nopenBrowser = true\n');
        assert.deepEqual(loadOptionalConfig(file), { ui: { openBrowser: true } });
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("loadOptionalConfig still throws when an explicit config path doesn't exist", () => {
    assert.throws(() => loadOptionalConfig(join(tmpdir(), "ushabti-missing-config-xyz.toml")), CliError);
});
