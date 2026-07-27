import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configTemplate } from "../src/features/config-template/service.js";
import { parse } from "smol-toml";

test("configTemplate returns the example config file verbatim", () => {
    const expected = readFileSync("ushabti.config.example.toml", "utf8");
    assert.equal(configTemplate(), expected);
});

test("configTemplate is valid TOML with the expected sections", () => {
    const parsed = parse(configTemplate());
    assert.ok(parsed.github);
    assert.ok(parsed.atlassian);
    assert.ok(parsed.jira);
});
