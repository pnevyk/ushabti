import { test } from "node:test";
import assert from "node:assert/strict";
import { UshabtiError, UsageError, InvalidCliInputError, NotImplementedError } from "../src/shared/errors.js";

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
