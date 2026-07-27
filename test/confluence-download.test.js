import { test } from "node:test";
import assert from "node:assert/strict";
import { toPage, toFolder, groupByParent, pruneTree, matchAttachmentByFileId } from "../src/features/confluence-download/service.js";

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
        type: "page",
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

test("toPage defaults type to \"page\" and passes through subtype \"live\"", () => {
    assert.equal(toPage(page()).type, "page");
    assert.equal(toPage(page({ subtype: "live" })).type, "live");
});

test("toPage unwraps a whole-file markdown code block instead of re-fencing it", () => {
    const rawMarkdownAdf = JSON.stringify({
        version: 1,
        type: "doc",
        content: [{ type: "codeBlock", attrs: { language: "markdown" }, content: [{ type: "text", text: "# Title\n\nBody." }] }],
    });
    const mapped = toPage(page({ body: { atlas_doc_format: { representation: "atlas_doc_format", value: rawMarkdownAdf } } }));
    assert.equal(mapped.description, "# Title\n\nBody.");
});

test("toPage still fences an embedded markdown code sample among other content", () => {
    const mixedAdf = JSON.stringify({
        version: 1,
        type: "doc",
        content: [
            { type: "paragraph", content: [{ type: "text", text: "See example:" }] },
            { type: "codeBlock", attrs: { language: "markdown" }, content: [{ type: "text", text: "# Sample" }] },
        ],
    });
    const mapped = toPage(page({ body: { atlas_doc_format: { representation: "atlas_doc_format", value: mixedAdf } } }));
    assert.equal(mapped.description, "See example:\n\n```markdown\n# Sample\n```");
});

test("toFolder maps standard fields (no body/content)", () => {
    const mapped = toFolder({ id: "555", title: "Onboarding", parentId: "111" });
    assert.deepEqual(mapped, { id: "555", title: "Onboarding", type: "folder", parentId: "111" });
});

test("toFolder nulls a missing parentId (top-level folder)", () => {
    const mapped = toFolder({ id: "555", title: "Onboarding" });
    assert.equal(mapped.parentId, null);
});

test("groupByParent builds a parentId -> children adjacency list", () => {
    const items = [
        { id: "2", parentId: "1" },
        { id: "3", parentId: "1" },
        { id: "4", parentId: "3" },
    ];
    const grouped = groupByParent(items);
    assert.deepEqual(grouped.get("1").map((i) => i.id), ["2", "3"]);
    assert.deepEqual(grouped.get("3").map((i) => i.id), ["4"]);
    assert.equal(grouped.get("4"), undefined);
});

test("pruneTree keeps current pages and folders at any depth", () => {
    const items = [
        { id: "2", parentId: "1", type: "page", title: "Child page", status: "current" },
        { id: "3", parentId: "1", type: "folder", title: "Child folder", status: "current" },
        { id: "4", parentId: "3", type: "page", title: "Grandchild", status: "current" },
    ];
    const { keptChildrenByParent, skipped } = pruneTree("1", groupByParent(items));
    assert.deepEqual(keptChildrenByParent.get("1").map((i) => i.id), ["2", "3"]);
    assert.deepEqual(keptChildrenByParent.get("3").map((i) => i.id), ["4"]);
    assert.deepEqual(skipped, []);
});

test("pruneTree drops an archived node and records why", () => {
    const items = [{ id: "2", parentId: "1", type: "page", title: "Old page", status: "archived" }];
    const { keptChildrenByParent, skipped } = pruneTree("1", groupByParent(items));
    assert.equal(keptChildrenByParent.get("1"), undefined);
    assert.deepEqual(skipped, [{ id: "2", title: "Old page", type: "page", reason: "status: archived" }]);
});

test("pruneTree drops an unsupported content type and prunes its whole subtree", () => {
    const items = [
        { id: "2", parentId: "1", type: "whiteboard", title: "Board", status: "current" },
        { id: "3", parentId: "2", type: "page", title: "Orphan under board", status: "current" },
    ];
    const { keptChildrenByParent, skipped } = pruneTree("1", groupByParent(items));
    assert.equal(keptChildrenByParent.get("1"), undefined);
    assert.equal(keptChildrenByParent.get("2"), undefined);
    assert.deepEqual(skipped, [{ id: "2", title: "Board", type: "whiteboard", reason: "unsupported content type: whiteboard" }]);
});

const attachments = [
    { fileId: "media-1", title: "one.png", downloadLink: "/download/one.png" },
    { fileId: "media-2", title: "two.jpg", downloadLink: "/download/two.jpg" },
];

test("matchAttachmentByFileId finds the attachment with the matching Media Services id", () => {
    assert.deepEqual(matchAttachmentByFileId(attachments, "media-2"), attachments[1]);
});

test("matchAttachmentByFileId returns null when no attachment matches (deleted/permissions/non-image link)", () => {
    assert.equal(matchAttachmentByFileId(attachments, "media-404"), null);
});
