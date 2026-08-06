import { test } from "node:test";
import assert from "node:assert/strict";
import { httpStatus, networkErrorCode, serviceLabel, secretsHint } from "../src/shared/error-signals.js";

test("httpStatus reads a direct .status (Octokit/jira.js shape)", () => {
    assert.equal(httpStatus({ status: 404 }), 404);
});

test("httpStatus falls back to .response.status", () => {
    assert.equal(httpStatus({ response: { status: 500 } }), 500);
});

test("httpStatus returns undefined when neither is present", () => {
    assert.equal(httpStatus({}), undefined);
});

test("networkErrorCode reads a direct .code", () => {
    assert.equal(networkErrorCode({ code: "ECONNREFUSED" }), "ECONNREFUSED");
});

test("networkErrorCode falls back to .cause.code (bare fetch TypeError shape)", () => {
    assert.equal(networkErrorCode({ cause: { code: "ENOTFOUND" } }), "ENOTFOUND");
});

test("networkErrorCode returns undefined when neither is present", () => {
    assert.equal(networkErrorCode({}), undefined);
});

test("serviceLabel maps known services and passes through unknowns", () => {
    assert.equal(serviceLabel("github"), "GitHub");
    assert.equal(serviceLabel("jira"), "Jira");
    assert.equal(serviceLabel("confluence"), "Confluence");
    assert.equal(serviceLabel("config"), "Your config file");
    assert.equal(serviceLabel("other"), "other");
});

test("secretsHint maps jira/confluence to atlassian, github to itself", () => {
    assert.equal(secretsHint("github"), "github");
    assert.equal(secretsHint("jira"), "atlassian");
    assert.equal(secretsHint("confluence"), "atlassian");
});
