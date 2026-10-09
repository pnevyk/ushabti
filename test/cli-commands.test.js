import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { resolveArgs as fetchArgs } from "../src/features/jira-fetch/command.js";
import { resolveArgs as jiraCreateArgs } from "../src/features/jira-create/command.js";
import { resolveId as jiraCommentsId } from "../src/features/jira-comments/command.js";
import { resolveFile as jiraUpdateFile } from "../src/features/jira-update/command.js";
import { pickProject } from "../src/features/jira-project/command.js";
import { resolveId as downloadId } from "../src/features/confluence-download/command.js";
import { resolveArgs as confluenceCreateArgs } from "../src/features/confluence-create/command.js";
import { resolveFile as uploadFile } from "../src/features/confluence-upload/command.js";
import { resolveArgs as prArgs } from "../src/features/pr-comments/command.js";
import { InvalidCliInputError } from "../src/shared/errors.js";

function withWarnings(fn) {
    const spy = mock.method(console, "error", () => {});
    try {
        return { result: fn(), warnings: spy.mock.calls.map((c) => c.arguments[0]) };
    } finally {
        spy.mock.restore();
    }
}

const noConfig = {};
const cfg = { jira: { project: "CFG" }, confluence: { space: "OPS" } };

test("jira fetch: ticket positional implies the project, no warning", () => {
    const { result, warnings } = withWarnings(() => fetchArgs({ values: {}, positionals: ["ABC-123"], config: noConfig }));
    assert.deepEqual(result, { id: "ABC-123" });
    assert.deepEqual(warnings, []);
});

test("jira fetch: project positional, URL and config fallback", () => {
    assert.deepEqual(fetchArgs({ values: {}, positionals: ["ABC"], config: noConfig }), { project: "ABC" });
    assert.deepEqual(fetchArgs({ values: {}, positionals: ["https://a.atlassian.net/browse/ABC-1"], config: noConfig }), { id: "ABC-1" });
    assert.deepEqual(fetchArgs({ values: {}, positionals: [], config: cfg }), { project: "CFG" });
    assert.throws(() => fetchArgs({ values: {}, positionals: [], config: noConfig }), InvalidCliInputError);
});

test("jira fetch: legacy --project + --id warns twice and ignores the project", () => {
    const { result, warnings } = withWarnings(() => fetchArgs({ values: { project: "ABC", id: "ABC-123" }, positionals: [], config: noConfig }));
    assert.deepEqual(result, { id: "ABC-123" });
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /--id is deprecated/);
    assert.match(warnings[1], /derived from the ticket id/);
});

test("jira fetch: legacy --project alone still works with a warning", () => {
    const { result, warnings } = withWarnings(() => fetchArgs({ values: { project: "ABC" }, positionals: [], config: noConfig }));
    assert.deepEqual(result, { project: "ABC" });
    assert.match(warnings[0], /--project is deprecated/);
});

test("jira fetch: conflicting project positional and --project is rejected", () => {
    assert.throws(() => fetchArgs({ values: { project: "XYZ" }, positionals: ["ABC"], config: noConfig }), InvalidCliInputError);
});

test("jira comments / update: positional and legacy flag", () => {
    assert.equal(jiraCommentsId({ values: {}, positionals: ["ABC-1"] }), "ABC-1");
    const { result, warnings } = withWarnings(() => jiraCommentsId({ values: { id: "ABC-1" }, positionals: [] }));
    assert.equal(result, "ABC-1");
    assert.equal(warnings.length, 1);
    assert.throws(() => jiraCommentsId({ values: {}, positionals: [] }), InvalidCliInputError);
    assert.equal(jiraUpdateFile({ values: {}, positionals: ["ABC-1.md"] }), "ABC-1.md");
    assert.equal(withWarnings(() => jiraUpdateFile({ values: { file: "a.md" }, positionals: [] })).result, "a.md");
    assert.throws(() => jiraUpdateFile({ values: {}, positionals: [] }), InvalidCliInputError);
});

test("jira project: positional, legacy flag, config", () => {
    assert.equal(pickProject({ values: {}, positionals: ["ABC"] }), "ABC");
    assert.equal(withWarnings(() => pickProject({ values: { project: "ABC" }, positionals: [] })).result, "ABC");
    assert.equal(pickProject({ values: {}, positionals: [] }), undefined);
});

test("jira create: file, optional project positional, config fallback", () => {
    assert.deepEqual(jiraCreateArgs({ values: {}, positionals: ["t.md", "ABC"], config: noConfig }), { file: "t.md", project: "ABC" });
    assert.deepEqual(jiraCreateArgs({ values: {}, positionals: ["t.md"], config: cfg }), { file: "t.md", project: "CFG" });
    assert.throws(() => jiraCreateArgs({ values: {}, positionals: ["t.md"], config: noConfig }), InvalidCliInputError);
    assert.throws(() => jiraCreateArgs({ values: {}, positionals: [], config: cfg }), InvalidCliInputError);
});

test("jira create: legacy --file/--project still work with warnings", () => {
    const { result, warnings } = withWarnings(() => jiraCreateArgs({ values: { file: "t.md", project: "ABC" }, positionals: [], config: noConfig }));
    assert.deepEqual(result, { file: "t.md", project: "ABC" });
    assert.equal(warnings.length, 2);
});

test("jira create: legacy --file with a project positional", () => {
    const { result } = withWarnings(() => jiraCreateArgs({ values: { file: "t.md" }, positionals: ["ABC"], config: noConfig }));
    assert.deepEqual(result, { file: "t.md", project: "ABC" });
});

test("confluence download: id, URL, legacy flag", () => {
    assert.equal(downloadId({ values: {}, positionals: ["12345"] }), "12345");
    assert.equal(downloadId({ values: {}, positionals: ["https://a.atlassian.net/wiki/spaces/ENG/pages/12345/T"] }), "12345");
    assert.equal(withWarnings(() => downloadId({ values: { id: "12345" }, positionals: [] })).result, "12345");
    assert.throws(() => downloadId({ values: {}, positionals: [] }), InvalidCliInputError);
});

test("confluence create: file, space positional/URL, config fallback, legacy flags", () => {
    assert.deepEqual(confluenceCreateArgs({ values: {}, positionals: ["p.md", "ENG"], config: noConfig }), { file: "p.md", space: "ENG" });
    assert.deepEqual(confluenceCreateArgs({ values: {}, positionals: ["p.md", "https://a.atlassian.net/wiki/spaces/ENG/overview"], config: noConfig }), { file: "p.md", space: "ENG" });
    assert.deepEqual(confluenceCreateArgs({ values: {}, positionals: ["p.md"], config: cfg }), { file: "p.md", space: "OPS" });
    assert.throws(() => confluenceCreateArgs({ values: {}, positionals: ["p.md"], config: noConfig }), InvalidCliInputError);
    const { result, warnings } = withWarnings(() => confluenceCreateArgs({ values: { file: "p.md", space: "ENG" }, positionals: [], config: noConfig }));
    assert.deepEqual(result, { file: "p.md", space: "ENG" });
    assert.equal(warnings.length, 2);
});

test("confluence upload: positional and legacy flag", () => {
    assert.equal(uploadFile({ values: {}, positionals: ["1.md"] }), "1.md");
    assert.equal(withWarnings(() => uploadFile({ values: { file: "1.md" }, positionals: [] })).result, "1.md");
    assert.throws(() => uploadFile({ values: {}, positionals: [] }), InvalidCliInputError);
});

test("pr comments: number, URL, legacy --pr, validation, repo conflict", () => {
    assert.deepEqual(prArgs({ values: {}, positionals: [] }), { repo: null, pr: null });
    assert.deepEqual(prArgs({ values: {}, positionals: ["42"] }), { repo: null, pr: 42 });
    assert.deepEqual(prArgs({ values: {}, positionals: ["https://github.com/acme/widget/pull/42"] }), { repo: "acme/widget", pr: 42 });
    assert.deepEqual(withWarnings(() => prArgs({ values: { pr: "7", repo: "a/b" }, positionals: [] })).result, { repo: "a/b", pr: 7 });
    assert.throws(() => prArgs({ values: {}, positionals: ["0"] }), InvalidCliInputError);
    assert.throws(() => prArgs({ values: {}, positionals: ["abc"] }), InvalidCliInputError);
    assert.throws(() => prArgs({ values: { repo: "x/y" }, positionals: ["https://github.com/acme/widget/pull/42"] }), InvalidCliInputError);
});
