import { test } from "node:test";
import assert from "node:assert/strict";
import { accountName } from "../src/shared/keychain.js";

test("accountName composes scope and key into one opaque identifier", () => {
    assert.equal(accountName("github.token", "global"), "global:github.token");
    assert.equal(accountName("atlassian.token", "550e8400-e29b-41d4-a716-446655440000"), "550e8400-e29b-41d4-a716-446655440000:atlassian.token");
});
