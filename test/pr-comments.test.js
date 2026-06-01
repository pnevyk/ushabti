import { test } from "node:test";
import assert from "node:assert/strict";
import { toThreads, pickPr } from "../src/features/pr-comments/service.js";
import { CliError } from "../src/shared/errors.js";

test("pickPr returns number of sole matching open PR", () => {
    const prs = [
        { number: 5, head: { ref: "feature" } },
        { number: 7, head: { ref: "other" } },
    ];
    assert.equal(pickPr(prs, "feature"), 5);
});

test("pickPr throws when no PR matches branch", () => {
    assert.throws(() => pickPr([{ number: 1, head: { ref: "x" } }], "feature"), CliError);
});

test("pickPr throws when multiple PRs match branch", () => {
    const prs = [
        { number: 1, head: { ref: "feature" } },
        { number: 2, head: { ref: "feature" } },
    ];
    assert.throws(() => pickPr(prs, "feature"), CliError);
});

test("drops resolved threads", () => {
    const nodes = [
        { isResolved: true, path: "a.js", line: 1, startLine: null, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
        { isResolved: false, path: "b.js", line: 2, startLine: null, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
    ];
    const threads = toThreads(nodes);
    assert.equal(threads.length, 1);
    assert.equal(threads[0].path, "b.js");
    assert.equal(threads[0].resolved, false);
});

test("keeps resolved threads with includeResolved", () => {
    const nodes = [
        { isResolved: true, path: "a.js", line: 1, startLine: null, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
        { isResolved: false, path: "b.js", line: 2, startLine: null, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
    ];
    const threads = toThreads(nodes, true);
    assert.equal(threads.length, 2);
    assert.equal(threads[0].path, "a.js");
    assert.equal(threads[0].resolved, true);
    assert.equal(threads[1].resolved, false);
});

test("maps comment fields and single-line range", () => {
    const nodes = [
        {
            isResolved: false,
            path: "src/foo.js",
            line: 12,
            startLine: null,
            originalLine: null,
            originalStartLine: null,
            comments: {
                nodes: [
                    { body: "nit", author: { login: "octocat" }, createdAt: "2026-05-29T10:00:00Z", diffHunk: "@@ -1 +1 @@\n-a\n+b" },
                ],
            },
        },
    ];
    const [thread] = toThreads(nodes);
    assert.deepEqual(thread, {
        path: "src/foo.js",
        resolved: false,
        startLine: 12,
        endLine: 12,
        diffHunk: "@@ -1 +1 @@\n-a\n+b",
        comments: [{ body: "nit", author: "octocat", createdAt: "2026-05-29T10:00:00Z" }],
    });
});

test("diffHunk taken from first comment, null when no comments", () => {
    const nodes = [
        { isResolved: false, path: "x.js", line: 1, startLine: null, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
    ];
    const [thread] = toThreads(nodes);
    assert.equal(thread.diffHunk, null);
});

test("multi-line range uses startLine", () => {
    const nodes = [
        { isResolved: false, path: "x.js", line: 20, startLine: 18, originalLine: null, originalStartLine: null, comments: { nodes: [] } },
    ];
    const [thread] = toThreads(nodes);
    assert.equal(thread.startLine, 18);
    assert.equal(thread.endLine, 20);
});

test("outdated thread falls back to original lines", () => {
    const nodes = [
        { isResolved: false, path: "x.js", line: null, startLine: null, originalLine: 7, originalStartLine: 5, comments: { nodes: [] } },
    ];
    const [thread] = toThreads(nodes);
    assert.equal(thread.startLine, 5);
    assert.equal(thread.endLine, 7);
});

test("null author and missing range become null", () => {
    const nodes = [
        {
            isResolved: false,
            path: null,
            line: null,
            startLine: null,
            originalLine: null,
            originalStartLine: null,
            comments: { nodes: [{ body: "x", author: null, createdAt: "2026-05-29T10:00:00Z" }] },
        },
    ];
    const [thread] = toThreads(nodes);
    assert.equal(thread.path, null);
    assert.equal(thread.startLine, null);
    assert.equal(thread.endLine, null);
    assert.equal(thread.comments[0].author, null);
});
