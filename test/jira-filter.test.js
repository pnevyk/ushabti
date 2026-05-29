import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compilePredicate, loadTickets, filterTickets } from "../src/features/jira-filter/service.js";
import { CliError } from "../src/shared/errors.js";

test("compilePredicate without expression matches all", () => {
    const p = compilePredicate(undefined);
    assert.equal(p({}), true);
    assert.equal(p({ parent: "X" }), true);
});

test("compilePredicate handles presence, equality and OR", () => {
    const noParent = compilePredicate("!parent");
    assert.equal(noParent({ parent: null }), true);
    assert.equal(noParent({ parent: "ABC-1" }), false);

    const assigned = compilePredicate('assignee === "acc-1"');
    assert.equal(assigned({ assignee: "acc-1" }), true);
    assert.equal(assigned({ assignee: "acc-2" }), false);
    assert.equal(assigned({}), false);

    const orphanOrUnassigned = compilePredicate("!parent || !assignee");
    assert.equal(orphanOrUnassigned({ parent: "ABC-1", assignee: "acc-1" }), false);
    assert.equal(orphanOrUnassigned({ parent: "ABC-1" }), true);
});

test("compilePredicate coerces result to boolean", () => {
    const p = compilePredicate("assignee");
    assert.equal(p({ assignee: "acc-1" }), true);
    assert.equal(p({ assignee: null }), false);
});

test("compilePredicate throws CliError on syntax error", () => {
    assert.throws(() => compilePredicate("parent ==="), CliError);
});

test("compiled predicate throws CliError on unknown identifier", () => {
    const p = compilePredicate("bogus === 1");
    assert.throws(() => p({}), CliError);
});

test("loadTickets reads a JSON file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        const file = join(dir, "tickets.json");
        await writeFile(file, JSON.stringify({ tickets: [{ id: "ABC-1", parent: "ABC-100" }, { id: "ABC-2", parent: null }] }));
        const tickets = await loadTickets(file);
        assert.deepEqual(tickets, [
            { fields: { id: "ABC-1", parent: "ABC-100" }, name: "ABC-1" },
            { fields: { id: "ABC-2", parent: null }, name: "ABC-2" },
        ]);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("loadTickets reads a markdown directory, falling back to filename for drafts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        await writeFile(join(dir, "ABC-1.md"), "---\nid: ABC-1\nparent: ABC-100\n---\nbody");
        await writeFile(join(dir, "draft.md"), "---\ntitle: New idea\n---\nbody");
        await writeFile(join(dir, "ignore.txt"), "not markdown");
        const tickets = await loadTickets(dir);
        const byName = Object.fromEntries(tickets.map((t) => [t.name, t.fields]));
        assert.deepEqual(Object.keys(byName).sort(), ["ABC-1", "draft"]);
        assert.equal(byName["ABC-1"].parent, "ABC-100");
        assert.equal(byName["draft"].title, "New idea");
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("loadTickets throws CliError when the path is missing", async () => {
    await assert.rejects(() => loadTickets(join(tmpdir(), "ushabti-missing-xyz")), CliError);
});

test("filterTickets returns ids of matching tickets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ushabti-"));
    try {
        const file = join(dir, "tickets.json");
        await writeFile(file, JSON.stringify({ tickets: [
            { id: "ABC-1", parent: "ABC-100", assignee: "acc-1" },
            { id: "ABC-2", parent: null, assignee: "acc-1" },
            { id: "ABC-3", parent: null, assignee: null },
        ] }));
        assert.deepEqual(await filterTickets({ inPath: file, where: "!parent" }), ["ABC-2", "ABC-3"]);
        assert.deepEqual(await filterTickets({ inPath: file, where: undefined }), ["ABC-1", "ABC-2", "ABC-3"]);
        assert.deepEqual(await filterTickets({ inPath: file, where: '!parent && assignee === "acc-1"' }), ["ABC-2"]);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
