import { test } from "node:test";
import assert from "node:assert/strict";
import { isSearchResultCapError, toGithubError } from "../src/shared/github-errors.js";
import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "../src/shared/errors.js";

test("toGithubError maps status 401/403/404/429/5xx", () => {
    assert.ok(toGithubError({ status: 401 }) instanceof AuthenticationError);
    assert.ok(toGithubError({ status: 403 }) instanceof PermissionError);
    assert.ok(toGithubError({ status: 404 }) instanceof NotFoundError);
    assert.ok(toGithubError({ status: 429 }) instanceof RateLimitedError);
    assert.ok(toGithubError({ status: 502 }) instanceof ServiceUnavailableError);
});

test("toGithubError maps a network error code with no status to ConnectionError", () => {
    const err = toGithubError({ code: "ENOTFOUND" });
    assert.ok(err instanceof ConnectionError);
    assert.equal(err.code, "ENOTFOUND");
});

test("toGithubError falls back to UnexpectedIoError for a GraphqlResponseError shape (200 + errors[], no status)", () => {
    const raw = new Error("Could not resolve to a PullRequest with the number 999.");
    const err = toGithubError(raw, { resource: "acme/repo#999" });
    assert.ok(err instanceof UnexpectedIoError);
    assert.match(err.message, /Could not resolve to a PullRequest/);
});

test("toGithubError threads service and extra (resource) through", () => {
    const err = toGithubError({ status: 404 }, { resource: "acme/repo#42" });
    assert.equal(err.service, "github");
    assert.equal(err.resource, "acme/repo#42");
});

test("toGithubError preserves the original error as cause", () => {
    const raw = { status: 401, message: "Bad credentials" };
    const err = toGithubError(raw);
    assert.equal(err.cause, raw);
});

test("isSearchResultCapError matches the search API's 1000-result 422", () => {
    const err = { status: 422, message: "Only the first 1000 search results are available." };
    assert.equal(isSearchResultCapError(err), true);
});

test("isSearchResultCapError rejects other 422s", () => {
    const err = { status: 422, message: "Validation Failed" };
    assert.equal(isSearchResultCapError(err), false);
});

test("isSearchResultCapError rejects other statuses", () => {
    assert.equal(isSearchResultCapError({ status: 404, message: "Only the first 1000 search results are available." }), false);
    assert.equal(isSearchResultCapError({}), false);
});
