import { test } from "node:test";
import assert from "node:assert/strict";
import { plugins, resolveDefaults } from "../../src/plugins/index.js";
import { CliError } from "../../src/shared/errors.js";

test("plugins registers mermaid and uml", () => {
    assert.deepEqual(
        plugins.map((p) => p.id),
        ["mermaid", "uml"],
    );
});

test("resolveDefaults returns an empty map when unset", () => {
    assert.deepEqual(resolveDefaults({}), {});
});

test("resolveDefaults returns a valid target/id map", () => {
    assert.deepEqual(resolveDefaults({ confluence: { plugins: { mermaid: "uml" } } }), { mermaid: "uml" });
});

test("resolveDefaults throws on an unknown target", () => {
    assert.throws(() => resolveDefaults({ confluence: { plugins: { bogus: "mermaid" } } }), CliError);
});

test("resolveDefaults throws on an id not registered for that target", () => {
    assert.throws(() => resolveDefaults({ confluence: { plugins: { mermaid: "toc" } } }), CliError);
});
