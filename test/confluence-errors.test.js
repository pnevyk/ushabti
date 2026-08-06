import { test } from "node:test";
import assert from "node:assert/strict";
import { AuthError, ForbiddenError, NotFoundError as ConfluenceNotFoundError, RateLimitError, ServerError, NetworkError } from "confluence.js";
import { toConfluenceError } from "../src/shared/confluence-errors.js";
import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "../src/shared/errors.js";

test("toConfluenceError dispatches via confluence.js's own typed errors", () => {
    assert.ok(toConfluenceError(new AuthError("bad creds", "Unauthorized", {})) instanceof AuthenticationError);
    assert.ok(toConfluenceError(new ForbiddenError("no", "Forbidden", {})) instanceof PermissionError);
    assert.ok(toConfluenceError(new ConfluenceNotFoundError("nope", "Not Found", {})) instanceof NotFoundError);
    assert.ok(toConfluenceError(new ServerError("oops", 503, "Service Unavailable", {})) instanceof ServiceUnavailableError);
});

test("toConfluenceError maps RateLimitError and carries retryAfterMs", () => {
    const raw = new RateLimitError("slow down", "Too Many Requests", {}, { retryAfterMs: 5000 });
    const err = toConfluenceError(raw);
    assert.ok(err instanceof RateLimitedError);
    assert.equal(err.retryAfterMs, 5000);
});

test("toConfluenceError maps NetworkError to ConnectionError, carrying its code", () => {
    const raw = new NetworkError("net fail", { cause: new Error("x"), code: "ECONNRESET", transient: true });
    const err = toConfluenceError(raw);
    assert.ok(err instanceof ConnectionError);
    assert.equal(err.code, "ECONNRESET");
});

test("toConfluenceError falls back to UnexpectedIoError for an unrecognized shape", () => {
    const err = toConfluenceError(new Error("something odd"));
    assert.ok(err instanceof UnexpectedIoError);
});

test("toConfluenceError threads service and extra (resource) through", () => {
    const err = toConfluenceError(new ConfluenceNotFoundError("nope", "Not Found", {}), { resource: "page 42" });
    assert.equal(err.service, "confluence");
    assert.equal(err.resource, "page 42");
});
