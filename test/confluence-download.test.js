import { test } from "node:test";
import assert from "node:assert/strict";
import {
    toPage,
    toFolder,
    sanitizeTitle,
    nodeBasename,
    nodeFilename,
    groupByParent,
    pruneTree,
} from "../src/features/confluence-download/service.js";

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

test("toFolder maps standard fields (no body/content)", () => {
    const mapped = toFolder({ id: "555", title: "Onboarding", parentId: "111" });
    assert.deepEqual(mapped, { id: "555", title: "Onboarding", type: "folder", parentId: "111" });
});

test("toFolder nulls a missing parentId (top-level folder)", () => {
    const mapped = toFolder({ id: "555", title: "Onboarding" });
    assert.equal(mapped.parentId, null);
});

test("sanitizeTitle strips illegal characters and collapses separators", () => {
    assert.equal(sanitizeTitle("Runbook"), "Runbook");
    assert.equal(sanitizeTitle("Deploy steps"), "Deploy-steps");
    assert.equal(sanitizeTitle("Q&A: Onboarding/Setup"), "Q&A-Onboarding-Setup");
});

test("sanitizeTitle yields empty string for blank or all-illegal input", () => {
    assert.equal(sanitizeTitle(""), "");
    assert.equal(sanitizeTitle("///"), "");
    assert.equal(sanitizeTitle(undefined), "");
});

test("sanitizeTitle caps length without leaving a trailing separator", () => {
    const slug = sanitizeTitle("a".repeat(79) + " " + "b".repeat(20));
    assert.equal(slug.length, 79);
    assert.equal(slug.endsWith("-"), false);
});

test("nodeBasename combines the slug and id, falling back to bare id", () => {
    assert.equal(nodeBasename({ id: "123", title: "Runbook" }), "Runbook-123");
    assert.equal(nodeBasename({ id: "123", title: "" }), "123");
    assert.equal(nodeBasename({ id: "123", title: "///" }), "123");
});

test("nodeFilename appends the extension to the basename", () => {
    assert.equal(nodeFilename({ id: "123", title: "Runbook" }, "md"), "Runbook-123.md");
    assert.equal(nodeFilename({ id: "123", title: "" }, "ushabti.json"), "123.ushabti.json");
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
