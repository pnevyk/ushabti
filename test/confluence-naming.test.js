import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTitle, nodeBasename, nodeFilename } from "../src/shared/confluence-naming.js";

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
