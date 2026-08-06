import { test } from "node:test";
import assert from "node:assert/strict";
import {
    UshabtiError,
    UsageError,
    InvalidCliInputError,
    NotImplementedError,
    IoError,
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "../src/shared/errors.js";

test("UshabtiError defaults exitCode to 1 and sets name from the subclass", () => {
    const err = new UshabtiError({ message: "x" });
    assert.equal(err.exitCode, 1);
    assert.equal(err.name, "UshabtiError");
    assert.equal(err.message, "x");
});

test("UsageError family takes a plain message and defaults exitCode to 1", () => {
    const err = new InvalidCliInputError("A ticket key is required. Use --id <ticket-key>.");
    assert.ok(err instanceof UsageError);
    assert.ok(err instanceof UshabtiError);
    assert.equal(err.name, "InvalidCliInputError");
    assert.equal(err.exitCode, 1);
    assert.equal(err.message, "A ticket key is required. Use --id <ticket-key>.");
});

test("NotImplementedError overrides exitCode to 2", () => {
    const err = new NotImplementedError("markdown serialization");
    assert.ok(err instanceof UsageError);
    assert.equal(err.exitCode, 2);
    assert.equal(err.message, "Not implemented: markdown serialization");
});

test("IoError stores service and cause", () => {
    const cause = new Error("boom");
    const err = new IoError({ service: "github", cause, message: "custom" });
    assert.ok(err instanceof UshabtiError);
    assert.equal(err.service, "github");
    assert.equal(err.cause, cause);
    assert.equal(err.message, "custom");
});

test("AuthenticationError names the service and the fix command", () => {
    const err = new AuthenticationError({ service: "github", cause: new Error("Bad credentials") });
    assert.ok(err instanceof IoError);
    assert.match(err.message, /GitHub/);
    assert.match(err.message, /ushabti secrets set github/);
});

test("AuthenticationError points jira/confluence at the atlassian secret", () => {
    const jira = new AuthenticationError({ service: "jira" });
    const confluence = new AuthenticationError({ service: "confluence" });
    assert.match(jira.message, /ushabti secrets set atlassian/);
    assert.match(confluence.message, /ushabti secrets set atlassian/);
});

test("PermissionError includes the resource when given", () => {
    const withResource = new PermissionError({ service: "confluence", resource: "space DEV" });
    const withoutResource = new PermissionError({ service: "confluence" });
    assert.match(withResource.message, /space DEV/);
    assert.equal(withResource.resource, "space DEV");
    assert.ok(!/undefined/.test(withoutResource.message));
});

test("NotFoundError includes the resource and falls back when absent", () => {
    const withResource = new NotFoundError({ service: "github", resource: "acme/repo#42" });
    assert.match(withResource.message, /acme\/repo#42/);
    assert.equal(withResource.resource, "acme/repo#42");

    const withoutResource = new NotFoundError({ service: "github" });
    assert.match(withoutResource.message, /couldn't find/);
});

test("NotFoundError adds a token-ambiguity note for jira only", () => {
    const jira = new NotFoundError({ service: "jira", resource: "ABC-123" });
    assert.match(jira.message, /make sure that your Atlassian token is valid/);
    assert.match(jira.message, /ushabti secrets set atlassian/);

    const github = new NotFoundError({ service: "github", resource: "acme/repo#42" });
    assert.ok(!/Atlassian token/.test(github.message));

    const confluence = new NotFoundError({ service: "confluence", resource: "page 42" });
    assert.ok(!/Atlassian token/.test(confluence.message));
});

test("RateLimitedError mentions the wait time when retryAfterMs is given", () => {
    const withWait = new RateLimitedError({ service: "github", retryAfterMs: 2500 });
    assert.match(withWait.message, /3s/); // ceil(2500/1000)
    assert.equal(withWait.retryAfterMs, 2500);

    const withoutWait = new RateLimitedError({ service: "github" });
    assert.match(withoutWait.message, /Wait a bit/);
});

test("ServiceUnavailableError and ConnectionError give an actionable next step", () => {
    const unavailable = new ServiceUnavailableError({ service: "confluence" });
    assert.match(unavailable.message, /try again/);

    const connection = new ConnectionError({ service: "github", code: "ENOTFOUND" });
    assert.match(connection.message, /ENOTFOUND/);
    assert.equal(connection.code, "ENOTFOUND");
});

test("UnexpectedIoError surfaces the cause's message", () => {
    const err = new UnexpectedIoError({ service: "github", cause: new Error("weird shape") });
    assert.match(err.message, /weird shape/);
});

test("every IoError preserves cause via the standard Error cause chain", () => {
    const cause = new Error("root cause");
    const err = new AuthenticationError({ service: "github", cause });
    assert.equal(err.cause, cause);
});
