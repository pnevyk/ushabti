import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { CliError } from "../src/shared/errors.js";
import { GLOBAL_SECRETS_PATH, LOCAL_SECRETS_PATH } from "../src/shared/secrets-file.js";
import {
    resolveSecret,
    resolveAtlassian,
    validateService,
    storeSecret,
    deleteSecret,
    listSecrets,
    purgeScope,
} from "../src/shared/secrets.js";

const MISS_DEPS = { getScopeId: () => null, getFromKeychain: () => null, getFromFile: () => undefined };

test("resolveSecret returns a scoped keychain hit without consulting the file tier", () => {
    let fileCalled = false;
    const result = resolveSecret(
        {},
        "github.token",
        {
            getScopeId: () => "scope-1",
            getFromKeychain: (key, scope) => (scope === "scope-1" ? "scoped-val" : null),
            getFromFile: () => {
                fileCalled = true;
                return undefined;
            },
        },
    );
    assert.equal(result, "scoped-val");
    assert.equal(fileCalled, false);
});

test("resolveSecret falls back from a scoped miss to the global keychain entry", () => {
    const result = resolveSecret(
        {},
        "github.token",
        {
            getScopeId: () => "scope-1",
            getFromKeychain: (key, scope) => (scope === "global" ? "global-val" : null),
            getFromFile: () => undefined,
        },
    );
    assert.equal(result, "global-val");
});

test("resolveSecret falls back to the secrets file when the keychain misses", () => {
    const result = resolveSecret({}, "github.token", { ...MISS_DEPS, getFromFile: () => "file-val" });
    assert.equal(result, "file-val");
});

test("resolveSecret falls back to an inline config value, warning once on stderr", (t) => {
    const spy = t.mock.method(console, "error", () => {});
    const config = { atlassian: { token: "inline-val" } };

    assert.equal(resolveSecret(config, "atlassian.token", MISS_DEPS), "inline-val");
    assert.equal(resolveSecret(config, "atlassian.token", MISS_DEPS), "inline-val");

    assert.equal(spy.mock.calls.length, 1);
    assert.match(spy.mock.calls[0].arguments[0], /atlassian\.token/);
});

test("resolveSecret treats an inline [jira].token as the legacy alias for atlassian.token", (t) => {
    t.mock.method(console, "error", () => {});
    const config = { jira: { token: "legacy-tok" } };
    assert.equal(resolveSecret(config, "atlassian.token", MISS_DEPS), "legacy-tok");
});

test("resolveSecret returns undefined when every tier misses", () => {
    assert.equal(resolveSecret({}, "github.token", MISS_DEPS), undefined);
});

test("resolveAtlassian prefers the [atlassian] section", (t) => {
    t.mock.method(console, "error", () => {});
    const resolved = resolveAtlassian(
        {
            atlassian: { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "tok" },
            jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" },
        },
        MISS_DEPS,
    );
    assert.deepEqual(resolved, { baseUrl: "https://acme.atlassian.net", email: "a@acme.com", token: "tok" });
});

test("resolveAtlassian falls back to [jira] when [atlassian] is absent", (t) => {
    t.mock.method(console, "error", () => {});
    const resolved = resolveAtlassian(
        { jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" } },
        MISS_DEPS,
    );
    assert.deepEqual(resolved, { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" });
});

test("resolveAtlassian falls back per-field for a partially migrated config", (t) => {
    t.mock.method(console, "error", () => {});
    const resolved = resolveAtlassian(
        {
            atlassian: { baseUrl: "https://acme.atlassian.net" },
            jira: { baseUrl: "https://old.atlassian.net", email: "old@acme.com", token: "oldtok" },
        },
        MISS_DEPS,
    );
    assert.deepEqual(resolved, { baseUrl: "https://acme.atlassian.net", email: "old@acme.com", token: "oldtok" });
});

test("resolveAtlassian throws naming missing atlassian.* keys", () => {
    assert.throws(() => resolveAtlassian({}, MISS_DEPS), CliError);
    assert.throws(
        () => resolveAtlassian({ atlassian: { baseUrl: "u" } }, MISS_DEPS),
        (err) => err instanceof CliError && err.message.includes("atlassian.email") && err.message.includes("atlassian.token"),
    );
});

test("validateService accepts github and atlassian, rejects anything else", () => {
    assert.doesNotThrow(() => validateService("github"));
    assert.doesNotThrow(() => validateService("atlassian"));
    assert.throws(() => validateService("jira"), CliError);
});

test("storeSecret stores globally in the keychain when it succeeds", () => {
    let fileCalled = false;
    const result = storeSecret(
        "github",
        "tok",
        {},
        { setInKeychain: () => true, setInFile: () => (fileCalled = true) },
    );
    assert.deepEqual(result, { key: "github.token", scope: "global", storedIn: "keychain" });
    assert.equal(fileCalled, false);
});

test("storeSecret falls back to the global secrets file when the keychain fails", () => {
    let filePath;
    const result = storeSecret(
        "github",
        "tok",
        {},
        {
            setInKeychain: () => false,
            setInFile: (key, value, path) => {
                filePath = path;
            },
        },
    );
    assert.deepEqual(result, { key: "github.token", scope: "global", storedIn: "file" });
    assert.equal(filePath, GLOBAL_SECRETS_PATH);
});

test("storeSecret with local registers a scope and stores under its id", () => {
    let keychainScope;
    const result = storeSecret(
        "atlassian",
        "tok",
        { local: true },
        {
            registerScope: () => "scope-xyz",
            setInKeychain: (key, value, scope) => {
                keychainScope = scope;
                return true;
            },
        },
    );
    assert.equal(result.storedIn, "keychain");
    assert.equal(result.scope, process.cwd());
    assert.equal(keychainScope, "scope-xyz");
});

test("storeSecret rejects an unknown service before touching any dependency", () => {
    assert.throws(() => storeSecret("jira", "tok", {}, {}), CliError);
});

test("deleteSecret skips the keychain when the local scope was never registered", () => {
    let keychainCalled = false;
    const result = deleteSecret(
        "github",
        { local: true },
        {
            getScopeId: () => null,
            deleteFromKeychain: () => {
                keychainCalled = true;
                return true;
            },
            deleteFromFile: () => false,
        },
    );
    assert.equal(keychainCalled, false);
    assert.deepEqual(result, { key: "github.token", scope: process.cwd(), removedFromKeychain: false, removedFromFile: false });
});

test("deleteSecret reports what was actually removed globally", () => {
    let filePath;
    const result = deleteSecret(
        "github",
        {},
        {
            deleteFromKeychain: () => true,
            deleteFromFile: (key, path) => {
                filePath = path;
                return false;
            },
        },
    );
    assert.deepEqual(result, { key: "github.token", scope: "global", removedFromKeychain: true, removedFromFile: false });
    assert.equal(filePath, GLOBAL_SECRETS_PATH);
});

test("listSecrets merges keychain ground truth, global file, and registered-scope files, flagging broken scopes", () => {
    const result = listSecrets({
        listFromKeychain: () => [
            { scope: "global", key: "github.token" },
            { scope: "id-1", key: "atlassian.token" },
            { scope: "orphan-id", key: "github.token" },
        ],
        listScopes: () => [
            { path: "/proj-a", id: "id-1" },
            { path: "/proj-b", id: "id-2" },
        ],
        readFileAt: (path) => {
            if (path === GLOBAL_SECRETS_PATH) return { atlassian: { token: "y" } };
            if (path === join("/proj-b", LOCAL_SECRETS_PATH)) return { github: { token: "z" } };
            return {};
        },
        exists: (path) => path === "/proj-a",
    });

    assert.deepEqual(result.entries, [
        { service: "github", scope: "global" },
        { service: "atlassian", scope: "/proj-a" },
        { service: "atlassian", scope: "global" },
        { service: "github", scope: "/proj-b" },
    ]);
    assert.deepEqual(result.brokenScopes, ["/proj-b"]);
});

test("listSecrets reports no entries and no broken scopes when nothing is stored", () => {
    const result = listSecrets({
        listFromKeychain: () => [],
        listScopes: () => [],
        readFileAt: () => ({}),
        exists: () => true,
    });
    assert.deepEqual(result, { entries: [], brokenScopes: [] });
});

test("purgeScope deletes both services at the resolved scope id and unregisters it", () => {
    const keychainCalls = [];
    const fileCalls = [];
    let unregistered;
    purgeScope("/proj-a", {
        getScopeId: () => "id-1",
        deleteFromKeychain: (key, scope) => keychainCalls.push([key, scope]),
        deleteFromFile: (key, path) => fileCalls.push([key, path]),
        unregisterScope: (path) => {
            unregistered = path;
        },
    });
    assert.deepEqual(keychainCalls, [
        ["github.token", "id-1"],
        ["atlassian.token", "id-1"],
    ]);
    assert.deepEqual(fileCalls, [
        ["github.token", join("/proj-a", LOCAL_SECRETS_PATH)],
        ["atlassian.token", join("/proj-a", LOCAL_SECRETS_PATH)],
    ]);
    assert.equal(unregistered, "/proj-a");
});

test("purgeScope skips the keychain when the scope has no id, but still cleans up the file and registry", () => {
    let keychainCalled = false;
    let unregistered;
    purgeScope("/proj-a", {
        getScopeId: () => null,
        deleteFromKeychain: () => {
            keychainCalled = true;
        },
        deleteFromFile: () => {},
        unregisterScope: (path) => {
            unregistered = path;
        },
    });
    assert.equal(keychainCalled, false);
    assert.equal(unregistered, "/proj-a");
});
