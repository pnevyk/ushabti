import { test } from "node:test";
import assert from "node:assert/strict";
import { toUpdateBody } from "../src/features/confluence-upload/service.js";

test("toUpdateBody keeps the current title when frontmatter omits it, increments the version", () => {
    const pageBody = toUpdateBody({
        data: { id: "12345" },
        body: "Hello",
        current: { title: "Runbook", version: { number: 3 } },
    });
    assert.equal(pageBody.id, "12345");
    assert.equal(pageBody.status, "current");
    assert.equal(pageBody.title, "Runbook");
    assert.equal(pageBody.version.number, 4);
    assert.equal(pageBody.body.representation, "atlas_doc_format");
    const adf = JSON.parse(pageBody.body.value);
    assert.equal(adf.content[0].content[0].text, "Hello");
});

test("toUpdateBody renames the page when frontmatter provides a title", () => {
    const pageBody = toUpdateBody({
        data: { id: "12345", title: "New title" },
        body: "",
        current: { title: "Old title", version: { number: 1 } },
    });
    assert.equal(pageBody.title, "New title");
    assert.equal(pageBody.version.number, 2);
});

test("toUpdateBody includes parentId when frontmatter provides it", () => {
    const pageBody = toUpdateBody({
        data: { id: "12345", parentId: "999" },
        body: "",
        current: { title: "Runbook", version: { number: 1 } },
    });
    assert.equal(pageBody.parentId, "999");
});

test("toUpdateBody omits parentId when frontmatter doesn't provide it", () => {
    const pageBody = toUpdateBody({
        data: { id: "12345" },
        body: "",
        current: { title: "Runbook", version: { number: 1 } },
    });
    assert.equal("parentId" in pageBody, false);
});
