import { test } from "node:test";
import assert from "node:assert/strict";
import { toComment, toMarkdown } from "../src/features/jira-fetch/comments.js";

const adf = (text) => ({ version: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

test("toComment maps all fields", () => {
    const comment = toComment({
        id: "10001",
        author: { displayName: "Jane Smith", accountId: "acc-1" },
        created: "2026-07-01T10:00:00.000Z",
        updated: "2026-07-01T10:00:00.000Z",
        body: adf("hello"),
    });

    assert.deepEqual(comment, {
        id: "10001",
        author: "Jane Smith",
        authorId: "acc-1",
        created: "2026-07-01T10:00:00.000Z",
        updated: "2026-07-01T10:00:00.000Z",
        body: "hello",
    });
});

test("toComment defaults missing author to empty name and null id", () => {
    const comment = toComment({ id: "1", body: adf("x") });
    assert.equal(comment.author, "");
    assert.equal(comment.authorId, null);
});

test("toComment nulls missing timestamps and empties missing body", () => {
    const comment = toComment({ id: "1", author: { displayName: "A", accountId: "a" } });
    assert.equal(comment.created, null);
    assert.equal(comment.updated, null);
    assert.equal(comment.body, "");
});

test("toMarkdown renders title and one section per comment", () => {
    const md = toMarkdown("ABC-123", [
        { id: "1", author: "Jane", authorId: "a", created: "2026-07-01T10:00:00Z", updated: "2026-07-01T10:00:00Z", body: "first" },
        { id: "2", author: "John", authorId: "b", created: "2026-07-02T14:00:00Z", updated: "2026-07-02T14:00:00Z", body: "second" },
    ]);

    assert.equal(
        md,
        "# ABC-123 comments\n\n## Jane — 2026-07-01T10:00:00Z\n\nfirst\n\n## John — 2026-07-02T14:00:00Z\n\nsecond\n",
    );
});

test("toMarkdown marks edited comments", () => {
    const md = toMarkdown("ABC-1", [
        { id: "1", author: "Jane", authorId: "a", created: "2026-07-01T10:00:00Z", updated: "2026-07-01T12:00:00Z", body: "x" },
    ]);
    assert.match(md, /## Jane — 2026-07-01T10:00:00Z \(edited 2026-07-01T12:00:00Z\)/);
});
