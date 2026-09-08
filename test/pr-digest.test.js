import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchQuery, isValidDate, resolveMe, searchCompletenessWarning, toPrEntry } from "../src/features/pr-digest/service.js";
import { MissingConfigError } from "../src/shared/errors.js";

test("buildSearchQuery with both bounds", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: "2026-05-01", until: "2026-06-01" });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:2026-05-01..2026-06-01");
});

test("buildSearchQuery with since only", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: "2026-05-01", until: null });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:>=2026-05-01");
});

test("buildSearchQuery with until only", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: null, until: "2026-06-01" });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:<=2026-06-01");
});

test("buildSearchQuery with author", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: "2026-05-01", until: null, author: "octocat" });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:>=2026-05-01 author:octocat");
});

test("buildSearchQuery with reviewer", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: "2026-05-01", until: null, reviewer: "octocat" });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:>=2026-05-01 reviewed-by:octocat");
});

test("buildSearchQuery with commenter", () => {
    const q = buildSearchQuery({ owner: "octo", name: "repo", since: "2026-05-01", until: null, commenter: "octocat" });
    assert.equal(q, "repo:octo/repo is:pr is:merged merged:>=2026-05-01 commenter:octocat");
});

test("resolveMe passes non-me values through", () => {
    assert.equal(resolveMe("octocat", "me-login"), "octocat");
    assert.equal(resolveMe(null, "me-login"), null);
});

test("resolveMe resolves me to the configured username", () => {
    assert.equal(resolveMe("me", "octocat"), "octocat");
});

test("resolveMe throws when me is used without a configured username", () => {
    assert.throws(() => resolveMe("me", undefined), MissingConfigError);
});

test("isValidDate accepts date and ISO datetime", () => {
    assert.equal(isValidDate("2026-06-01"), true);
    assert.equal(isValidDate("2026-06-01T00:00:00Z"), true);
    assert.equal(isValidDate("2026-06-01T12:30:00+02:00"), true);
});

test("isValidDate rejects malformed input", () => {
    assert.equal(isValidDate("not-a-date"), false);
    assert.equal(isValidDate(""), false);
    assert.equal(isValidDate("2026-6-1"), false);
});

test("searchCompletenessWarning returns null when results are complete", () => {
    assert.equal(searchCompletenessWarning({ totalCount: 5, incompleteResults: false, itemsFetched: 5 }), null);
});

test("searchCompletenessWarning warns when totalCount exceeds itemsFetched", () => {
    const warning = searchCompletenessWarning({ totalCount: 1500, incompleteResults: false, itemsFetched: 1000 });
    assert.match(warning, /1500 PRs but only 1000/);
});

test("searchCompletenessWarning warns when incompleteResults is true", () => {
    const warning = searchCompletenessWarning({ totalCount: 5, incompleteResults: true, itemsFetched: 5 });
    assert.match(warning, /incomplete results/);
});

test("searchCompletenessWarning prefers the incompleteResults message when both apply", () => {
    const warning = searchCompletenessWarning({ totalCount: 1500, incompleteResults: true, itemsFetched: 1000 });
    assert.match(warning, /incomplete results/);
});

test("toPrEntry maps fields and comment streams", () => {
    const item = {
        number: 42,
        title: "Add thing",
        user: { login: "octocat" },
        created_at: "2026-05-20T10:00:00Z",
        pull_request: { merged_at: "2026-05-22T08:00:00Z" },
        html_url: "https://github.com/octo/repo/pull/42",
        body: "does the thing",
    };
    const entry = toPrEntry(item, {
        reviews: [{ user: { login: "rev" }, state: "APPROVED", body: "lgtm", submitted_at: "2026-05-21T09:00:00Z" }],
        reviewComments: [
            { path: "a.js", line: 12, body: "nit", user: { login: "rev" }, created_at: "2026-05-21T09:01:00Z", diff_hunk: "@@" },
        ],
        comments: [{ body: "thanks", user: { login: "octocat" }, created_at: "2026-05-21T10:00:00Z" }],
    });
    assert.deepEqual(entry, {
        number: 42,
        title: "Add thing",
        author: "octocat",
        createdAt: "2026-05-20T10:00:00Z",
        mergedAt: "2026-05-22T08:00:00Z",
        url: "https://github.com/octo/repo/pull/42",
        body: "does the thing",
        reviews: [{ author: "rev", state: "APPROVED", body: "lgtm", submittedAt: "2026-05-21T09:00:00Z" }],
        reviewComments: [
            { path: "a.js", line: 12, body: "nit", author: "rev", createdAt: "2026-05-21T09:01:00Z", diffHunk: "@@" },
        ],
        comments: [{ body: "thanks", author: "octocat", createdAt: "2026-05-21T10:00:00Z" }],
    });
});

test("toPrEntry drops PENDING reviews", () => {
    const entry = toPrEntry({ number: 1 }, {
        reviews: [
            { user: { login: "a" }, state: "PENDING", body: "wip", submitted_at: null },
            { user: { login: "b" }, state: "COMMENTED", body: "ok", submitted_at: "2026-05-21T09:00:00Z" },
        ],
        reviewComments: [],
        comments: [],
    });
    assert.equal(entry.reviews.length, 1);
    assert.equal(entry.reviews[0].author, "b");
});

test("toPrEntry filters comments and reviewComments by commentsBy, keeping reviews untouched", () => {
    const entry = toPrEntry(
        { number: 1 },
        {
            reviews: [{ user: { login: "rev" }, state: "APPROVED", body: "lgtm", submitted_at: "t" }],
            reviewComments: [
                { path: "a.js", line: 1, body: "mine", user: { login: "octocat" }, created_at: "t", diff_hunk: "@@" },
                { path: "a.js", line: 2, body: "not mine", user: { login: "rev" }, created_at: "t", diff_hunk: "@@" },
            ],
            comments: [
                { body: "mine", user: { login: "octocat" }, created_at: "t" },
                { body: "not mine", user: { login: "rev" }, created_at: "t" },
            ],
            commentsBy: "octocat",
        },
    );
    assert.equal(entry.reviews.length, 1);
    assert.deepEqual(entry.reviewComments.map((c) => c.body), ["mine"]);
    assert.deepEqual(entry.comments.map((c) => c.body), ["mine"]);
});

test("toPrEntry falls back line to original_line and is null-safe", () => {
    const entry = toPrEntry(
        { number: 1, user: null, body: null, pull_request: null },
        {
            reviews: [],
            reviewComments: [{ path: "x.js", line: null, original_line: 7, body: "c", user: null, created_at: "t", diff_hunk: "h" }],
            comments: [{ body: "c", user: null, created_at: "t" }],
        },
    );
    assert.equal(entry.author, null);
    assert.equal(entry.body, null);
    assert.equal(entry.mergedAt, null);
    assert.equal(entry.reviewComments[0].line, 7);
    assert.equal(entry.reviewComments[0].author, null);
    assert.equal(entry.comments[0].author, null);
});
