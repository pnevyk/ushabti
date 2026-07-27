import { test } from "node:test";
import assert from "node:assert/strict";
import { toPage } from "../src/features/confluence-download/service.js";

const adf = (text) => JSON.stringify({ version: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const page = (overrides) => ({
    id: "12345",
    title: "Runbook",
    spaceId: "999",
    parentId: "111",
    body: { atlas_doc_format: { representation: "atlas_doc_format", value: adf("Body text") } },
    ...overrides,
});

test("toPage maps standard fields and converts the ADF body to markdown", () => {
    const mapped = toPage(page());
    assert.deepEqual(mapped, {
        id: "12345",
        title: "Runbook",
        spaceId: "999",
        parentId: "111",
        description: "Body text",
    });
});

test("toPage nulls a missing parentId (top-level page)", () => {
    const mapped = toPage(page({ parentId: undefined }));
    assert.equal(mapped.parentId, null);
});

test("toPage empties the description when the page has no body", () => {
    const mapped = toPage(page({ body: undefined }));
    assert.equal(mapped.description, "");
});
