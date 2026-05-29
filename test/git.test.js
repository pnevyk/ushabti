import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRemoteUrl } from "../src/shared/git.js";

test("parses SSH remote", () => {
    assert.equal(parseRemoteUrl("git@github.com:owner/name.git"), "owner/name");
});

test("parses HTTPS remote", () => {
    assert.equal(parseRemoteUrl("https://github.com/owner/name.git"), "owner/name");
});

test("parses HTTPS remote without .git", () => {
    assert.equal(parseRemoteUrl("https://github.com/owner/name"), "owner/name");
});

test("parses ssh:// remote", () => {
    assert.equal(parseRemoteUrl("ssh://git@github.com/owner/name.git"), "owner/name");
});

test("throws on unrecognized remote", () => {
    assert.throws(() => parseRemoteUrl("not-a-url"), /Unrecognized git remote URL/);
});
