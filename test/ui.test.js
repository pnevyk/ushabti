import { test } from "node:test";
import assert from "node:assert/strict";
import { openerCommand, resolveOpenBrowser } from "../src/shared/ui.js";
import { InvalidCliInputError } from "../src/shared/errors.js";

test("openerCommand uses open on darwin", () => {
    assert.deepEqual(openerCommand("darwin", "http://127.0.0.1:1234"), ["open", ["http://127.0.0.1:1234"]]);
});

test("openerCommand uses cmd start on win32", () => {
    assert.deepEqual(openerCommand("win32", "http://127.0.0.1:1234"), [
        "cmd",
        ["/c", "start", "", "http://127.0.0.1:1234"],
    ]);
});

test("openerCommand falls back to xdg-open elsewhere", () => {
    assert.deepEqual(openerCommand("linux", "http://127.0.0.1:1234"), ["xdg-open", ["http://127.0.0.1:1234"]]);
});

test("resolveOpenBrowser defaults to false with no flags or config", () => {
    assert.equal(resolveOpenBrowser({}, {}), false);
});

test("resolveOpenBrowser follows config when no flag is given", () => {
    assert.equal(resolveOpenBrowser({ ui: { openBrowser: true } }, {}), true);
});

test("resolveOpenBrowser: --browser overrides config", () => {
    assert.equal(resolveOpenBrowser({ ui: { openBrowser: false } }, { browser: true }), true);
});

test("resolveOpenBrowser: --no-browser forces false even when config is true", () => {
    assert.equal(resolveOpenBrowser({ ui: { openBrowser: true } }, { noBrowser: true }), false);
});

test("resolveOpenBrowser throws when both --browser and --no-browser are given", () => {
    assert.throws(() => resolveOpenBrowser({}, { browser: true, noBrowser: true }), InvalidCliInputError);
});
