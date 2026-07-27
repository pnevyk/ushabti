import { test } from "node:test";
import assert from "node:assert/strict";
import { toCreateBody, applyCreatedId } from "../src/features/confluence-create/service.js";
import { parse } from "../src/shared/frontmatter.js";
import { CliError } from "../src/shared/errors.js";

test("toCreateBody builds required fields with ADF body", () => {
    const pageBody = toCreateBody({ data: { title: "Runbook" }, body: "Hello", spaceId: "999" });
    assert.equal(pageBody.spaceId, "999");
    assert.equal(pageBody.status, "current");
    assert.equal(pageBody.title, "Runbook");
    assert.equal(pageBody.body.representation, "atlas_doc_format");
    const adf = JSON.parse(pageBody.body.value);
    assert.equal(adf.content[0].content[0].text, "Hello");
    assert.equal("parentId" in pageBody, false);
});

test("toCreateBody includes optional parentId", () => {
    const pageBody = toCreateBody({ data: { title: "Runbook", parentId: "111" }, body: "", spaceId: "999" });
    assert.equal(pageBody.parentId, "111");
});

test("toCreateBody requires title", () => {
    assert.throws(() => toCreateBody({ data: {}, body: "", spaceId: "999" }), CliError);
});

test("toCreateBody sets subtype live when frontmatter type is live", () => {
    const pageBody = toCreateBody({ data: { title: "Runbook", type: "live" }, body: "", spaceId: "999" });
    assert.equal(pageBody.subtype, "live");
});

test("toCreateBody omits subtype for a regular page (default or explicit type: page)", () => {
    assert.equal("subtype" in toCreateBody({ data: { title: "Runbook" }, body: "", spaceId: "999" }), false);
    assert.equal("subtype" in toCreateBody({ data: { title: "Runbook", type: "page" }, body: "", spaceId: "999" }), false);
});

test("applyCreatedId sets id as the first frontmatter field and preserves body", () => {
    const content = applyCreatedId({ data: { title: "Runbook" }, body: "Hello", id: "12345" });
    assert.match(content, /^---\nid: "?12345"?\n/);
    const { data, body } = parse(content);
    assert.equal(data.id, "12345");
    assert.equal(data.title, "Runbook");
    assert.equal(body, "Hello");
});

test("applyCreatedId overrides a pre-existing id", () => {
    const content = applyCreatedId({ data: { id: "999", title: "t" }, body: "", id: "12345" });
    const { data } = parse(content);
    assert.equal(data.id, "12345");
});
