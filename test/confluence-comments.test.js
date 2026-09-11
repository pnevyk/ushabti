import { test } from "node:test";
import assert from "node:assert/strict";
import { toThread, toCommentEntry, toMarkdown } from "../src/features/confluence-comments/service.js";

const adf = (text) => JSON.stringify({ version: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const raw = (overrides) => ({
    id: "999",
    status: "current",
    version: { authorId: "acc-1", createdAt: "2026-08-14T09:03:00.000Z" },
    body: { atlas_doc_format: { representation: "atlas_doc_format", value: adf("hello") } },
    ...overrides,
});

test("toCommentEntry maps id, authorId, createdAt and body", () => {
    const comment = toCommentEntry(raw());
    assert.deepEqual(comment, {
        id: "999",
        authorId: "acc-1",
        createdAt: "2026-08-14T09:03:00.000Z",
        body: "hello",
    });
});

test("toCommentEntry nulls missing id/author/timestamp and empties missing body", () => {
    const comment = toCommentEntry({});
    assert.equal(comment.id, null);
    assert.equal(comment.authorId, null);
    assert.equal(comment.createdAt, null);
    assert.equal(comment.body, "");
});

test("toThread builds a footer thread with no resolutionStatus/selection, root plus replies in order", () => {
    const root = raw({ id: "1", version: { authorId: "acc-1", createdAt: "2026-08-14T09:03:00.000Z" } });
    const reply = raw({ id: "2", version: { authorId: "acc-2", createdAt: "2026-08-14T09:10:00.000Z" } });
    const thread = toThread(root, [reply], "footer");
    assert.equal(thread.kind, "footer");
    assert.equal(thread.resolutionStatus, null);
    assert.equal(thread.selection, null);
    assert.deepEqual(
        thread.comments.map((c) => c.id),
        ["1", "2"],
    );
});

test("toThread builds an inline thread reading resolutionStatus/selection off the root only, sorted chronologically", () => {
    const root = raw({
        id: "1",
        version: { authorId: "acc-1", createdAt: "2026-08-14T10:22:00.000Z" },
        resolutionStatus: "open",
        properties: { inlineOriginalSelection: "the retry budget defaults to 3 attempts" },
    });
    const reply = raw({ id: "2", version: { authorId: "acc-2", createdAt: "2026-08-14T10:20:00.000Z" } });
    const thread = toThread(root, [reply], "inline");
    assert.equal(thread.kind, "inline");
    assert.equal(thread.resolutionStatus, "open");
    assert.equal(thread.selection, "the retry budget defaults to 3 attempts");
    assert.deepEqual(
        thread.comments.map((c) => c.id),
        ["2", "1"],
    );
});

test("toMarkdown renders a footer thread as a Type bullet, no quote, one ## section per comment", () => {
    const md = toMarkdown("123", [
        {
            kind: "footer",
            resolutionStatus: null,
            selection: null,
            comments: [{ id: "10", authorId: "acc-1", createdAt: "2026-08-14T09:03:00.000Z", body: "Looks good." }],
        },
    ]);
    assert.equal(md, "# 123 comments\n\n- Type: footer\n\n## Author: acc-1 (2026-08-14T09:03:00.000Z) [id: 10]\n\nLooks good.\n");
});

test("toMarkdown renders an inline thread's Type/Status bullets and quoted selection above the first author", () => {
    const md = toMarkdown("123", [
        {
            kind: "inline",
            resolutionStatus: "resolved",
            selection: "the retry budget",
            comments: [
                { id: "10", authorId: "acc-1", createdAt: "2026-08-14T10:22:00.000Z", body: "Should this be configurable?" },
                { id: "11", authorId: "acc-2", createdAt: "2026-08-14T11:47:00.000Z", body: "Good point." },
            ],
        },
    ]);
    assert.equal(
        md,
        "# 123 comments\n\n- Type: inline\n- Status: resolved\n\n> the retry budget\n\n" +
            "## Author: acc-1 (2026-08-14T10:22:00.000Z) [id: 10]\n\nShould this be configurable?\n\n" +
            "## Author: acc-2 (2026-08-14T11:47:00.000Z) [id: 11]\n\nGood point.\n",
    );
});

test("toMarkdown separates threads with an --- rule", () => {
    const md = toMarkdown("123", [
        { kind: "footer", resolutionStatus: null, selection: null, comments: [{ id: "1", authorId: "a", createdAt: "t1", body: "x" }] },
        { kind: "footer", resolutionStatus: null, selection: null, comments: [{ id: "2", authorId: "b", createdAt: "t2", body: "y" }] },
    ]);
    assert.match(md, /x\n\n---\n\n- Type: footer/);
});
