import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, stringify } from "../src/shared/frontmatter.js";

test("parse: splits frontmatter and body", () => {
    const { data, body } = parse("---\ntitle: Hi\ntype: Story\n---\nThe body\n");
    assert.deepEqual(data, { title: "Hi", type: "Story" });
    assert.equal(body, "The body\n");
});

test("parse: no frontmatter returns empty data and full body", () => {
    const { data, body } = parse("just text");
    assert.deepEqual(data, {});
    assert.equal(body, "just text");
});

test("parse: unterminated fence is treated as body", () => {
    const { data, body } = parse("---\ntitle: Hi\nbody without close");
    assert.deepEqual(data, {});
    assert.equal(body, "---\ntitle: Hi\nbody without close");
});

test("stringify: drops null/undefined keys", () => {
    const out = stringify({ id: "ABC-1", title: "Hi", parent: null, storyPoints: undefined }, "Body");
    assert.equal(out, "---\nid: ABC-1\ntitle: Hi\n---\nBody");
});

test("round-trip: stringify then parse", () => {
    const data = { id: "ABC-1", title: "Hi", type: "Task" };
    const { data: parsed, body } = parse(stringify(data, "Hello\n"));
    assert.deepEqual(parsed, data);
    assert.equal(body, "Hello\n");
});
