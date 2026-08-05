import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    setSecretInFile,
    deleteSecretFromFile,
    readSecretFile,
    getScopeId,
    registerScope,
    listScopes,
    unregisterScope,
} from "../src/shared/secrets-file.js";

async function withTmpDir(fn) {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-secrets-"));
    try {
        await fn(dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

test("setSecretInFile creates a new file and preserves sibling keys on a second write", async () => {
    await withTmpDir(async (dir) => {
        const file = join(dir, "secrets.toml");
        setSecretInFile("github.token", "gh-tok", file);
        setSecretInFile("atlassian.token", "atl-tok", file);
        assert.deepEqual(readSecretFile(file), {
            github: { token: "gh-tok" },
            atlassian: { token: "atl-tok" },
        });
    });
});

test("readSecretFile exposes a dotted key from a single file's content", async () => {
    await withTmpDir(async (dir) => {
        const file = join(dir, "secrets.toml");
        setSecretInFile("github.token", "gh-tok", file);
        assert.equal(readSecretFile(file).github.token, "gh-tok");
    });
});

test("deleteSecretFromFile removes a present key and reports true, false when absent", async () => {
    await withTmpDir(async (dir) => {
        const file = join(dir, "secrets.toml");
        setSecretInFile("github.token", "gh-tok", file);

        assert.equal(deleteSecretFromFile("github.token", file), true);
        assert.equal(readSecretFile(file).github?.token, undefined);
        assert.equal(deleteSecretFromFile("github.token", file), false);
    });
});

test("readSecretFile returns {} for a missing file", async () => {
    await withTmpDir(async (dir) => {
        assert.deepEqual(readSecretFile(join(dir, "nope.toml")), {});
    });
});

test("getScopeId returns the exact match for a registered directory", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        const id = registerScope("/home/user/project-a", registry);
        assert.equal(getScopeId("/home/user/project-a", registry), id);
    });
});

test("getScopeId walks up to the nearest registered ancestor", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        const id = registerScope("/home/user/project-a", registry);
        assert.equal(getScopeId("/home/user/project-a/src/deep", registry), id);
    });
});

test("getScopeId returns null when no ancestor is registered", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        registerScope("/home/user/project-a", registry);
        assert.equal(getScopeId("/home/user/project-b", registry), null);
    });
});

test("registerScope is idempotent for the same directory", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        const first = registerScope("/home/user/project-a", registry);
        const second = registerScope("/home/user/project-a", registry);
        assert.equal(first, second);
    });
});

test("registerScope keys strictly on the literal directory, not an ancestor's existing scope", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        const parentId = registerScope("/home/user/project-a", registry);
        const childId = registerScope("/home/user/project-a/subdir", registry);
        assert.notEqual(parentId, childId);
    });
});

test("listScopes and unregisterScope reflect the registry's current state", async () => {
    await withTmpDir(async (dir) => {
        const registry = join(dir, "secrets.toml");
        const idA = registerScope("/home/user/project-a", registry);
        registerScope("/home/user/project-b", registry);

        assert.deepEqual(
            new Set(listScopes(registry).map((s) => s.path)),
            new Set(["/home/user/project-a", "/home/user/project-b"]),
        );

        assert.equal(unregisterScope("/home/user/project-a", registry), true);
        assert.deepEqual(listScopes(registry).map((s) => s.path), ["/home/user/project-b"]);
        assert.equal(getScopeId("/home/user/project-a", registry), null);
        assert.equal(unregisterScope("/home/user/project-a", registry), false);
        assert.notEqual(idA, undefined);
    });
});
