import { test } from "node:test";
import assert from "node:assert/strict";
import { findMediaIds, rewriteMediaLinks, mediaSkippedMessage } from "../src/shared/media-download.js";

test("findMediaIds extracts a single attachment reference", () => {
    assert.deepEqual(findMediaIds("![alt](attachment:abc-123)"), ["abc-123"]);
});

test("findMediaIds extracts multiple distinct references in order", () => {
    const body = "![one](attachment:id-1) text ![two](attachment:id-2)";
    assert.deepEqual(findMediaIds(body), ["id-1", "id-2"]);
});

test("findMediaIds dedupes a repeated id", () => {
    const body = "![a](attachment:id-1) ... ![b](attachment:id-1)";
    assert.deepEqual(findMediaIds(body), ["id-1"]);
});

test("findMediaIds returns [] for a body with no media", () => {
    assert.deepEqual(findMediaIds("just plain text, no images here"), []);
});

test("findMediaIds returns [] for missing/empty input", () => {
    assert.deepEqual(findMediaIds(undefined), []);
    assert.deepEqual(findMediaIds(""), []);
});

test("findMediaIds ignores malformed scheme text that doesn't match", () => {
    assert.deepEqual(findMediaIds("attachment: id-1"), []);
    assert.deepEqual(findMediaIds("not-attachment:id-1"), ["id-1"]);
});

test("rewriteMediaLinks replaces a matched id with its resolved filename", () => {
    const body = "![alt](attachment:id-1)";
    const map = new Map([["id-1", "page.id-1.png"]]);
    assert.equal(rewriteMediaLinks(body, map), "![alt](page.id-1.png)");
});

test("rewriteMediaLinks rewrites every occurrence of a repeated id", () => {
    const body = "![a](attachment:id-1) and again ![b](attachment:id-1)";
    const map = new Map([["id-1", "page.id-1.png"]]);
    assert.equal(rewriteMediaLinks(body, map), "![a](page.id-1.png) and again ![b](page.id-1.png)");
});

test("rewriteMediaLinks leaves an unmatched id untouched", () => {
    const body = "![alt](attachment:missing-id)";
    assert.equal(rewriteMediaLinks(body, new Map()), body);
});

test("mediaSkippedMessage pluralises the attachment count", () => {
    assert.equal(mediaSkippedMessage("ABC-1", 1), "Skipping 1 attachment of ABC-1: not downloaded when writing to stdout");
    assert.equal(mediaSkippedMessage("ABC-1", 2), "Skipping 2 attachments of ABC-1: not downloaded when writing to stdout");
});
