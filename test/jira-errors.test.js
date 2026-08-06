import { test } from "node:test";
import assert from "node:assert/strict";
import { toJiraError } from "../src/shared/jira-errors.js";
import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "../src/shared/errors.js";

test("toJiraError maps status 401/403/404/429/5xx (jira.js HttpException shape)", () => {
    assert.ok(toJiraError({ status: 401 }) instanceof AuthenticationError);
    assert.ok(toJiraError({ status: 403 }) instanceof PermissionError);
    assert.ok(toJiraError({ status: 404 }) instanceof NotFoundError);
    assert.ok(toJiraError({ status: 429 }) instanceof RateLimitedError);
    assert.ok(toJiraError({ status: 500 }) instanceof ServiceUnavailableError);
});

test("toJiraError maps a network error code with no status to ConnectionError", () => {
    const err = toJiraError({ code: "ECONNREFUSED" });
    assert.ok(err instanceof ConnectionError);
    assert.equal(err.code, "ECONNREFUSED");
});

test("toJiraError falls back to UnexpectedIoError for an unrecognized shape", () => {
    const err = toJiraError({ message: "something odd" });
    assert.ok(err instanceof UnexpectedIoError);
});

test("toJiraError threads service and extra (resource) through", () => {
    const err = toJiraError({ status: 404 }, { resource: "ABC-123" });
    assert.equal(err.service, "jira");
    assert.equal(err.resource, "ABC-123");
});
