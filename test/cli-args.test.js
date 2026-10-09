import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
    isTicketKey,
    projectOfKey,
    pickSubject,
    parseJiraRef,
    parseConfluenceRef,
    parsePageId,
    parsePrRef,
    resolveProject,
    resolveSpace,
    expectPositionals,
} from "../src/shared/cli-args.js";
import { InvalidCliInputError } from "../src/shared/errors.js";

function captureWarnings(fn) {
    const spy = mock.method(console, "error", () => {});
    try {
        const result = fn();
        return { result, warnings: spy.mock.calls.map((c) => c.arguments[0]) };
    } finally {
        spy.mock.restore();
    }
}

test("isTicketKey distinguishes ticket keys from project keys", () => {
    assert.equal(isTicketKey("ABC-123"), true);
    assert.equal(isTicketKey("AB_C2-7"), true);
    assert.equal(isTicketKey("ABC"), false);
    assert.equal(isTicketKey("abc-1"), false);
});

test("projectOfKey strips the issue number", () => {
    assert.equal(projectOfKey("ABC-123"), "ABC");
    assert.equal(projectOfKey("A_B-1"), "A_B");
});

test("expectPositionals rejects surplus arguments", () => {
    expectPositionals(["a"], 1, "usage");
    assert.throws(() => expectPositionals(["a", "b"], 1, "usage"), InvalidCliInputError);
});

test("pickSubject returns the positional without warning", () => {
    const { result, warnings } = captureWarnings(() => pickSubject({ positional: "X-1", flagName: "--id", hint: "h" }));
    assert.equal(result, "X-1");
    assert.deepEqual(warnings, []);
});

test("pickSubject falls back to the legacy flag and warns", () => {
    const { result, warnings } = captureWarnings(() => pickSubject({ flagValue: "X-1", flagName: "--id", hint: "Use the argument." }));
    assert.equal(result, "X-1");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /--id is deprecated.*Use the argument\./);
});

test("pickSubject accepts equal positional and flag, warning once", () => {
    const { result, warnings } = captureWarnings(() => pickSubject({ positional: "X-1", flagValue: "X-1", flagName: "--id", hint: "h" }));
    assert.equal(result, "X-1");
    assert.equal(warnings.length, 1);
});

test("pickSubject rejects a conflicting positional and flag", () => {
    assert.throws(() => pickSubject({ positional: "X-1", flagValue: "X-2", flagName: "--id", hint: "h" }), InvalidCliInputError);
});

test("parseJiraRef passes bare keys through and extracts from URLs", () => {
    assert.equal(parseJiraRef("ABC-1"), "ABC-1");
    assert.equal(parseJiraRef("https://acme.atlassian.net/browse/ABC-123"), "ABC-123");
    assert.equal(parseJiraRef("https://acme.atlassian.net/jira/software/projects/ABC/boards/1?selectedIssue=ABC-9"), "ABC-9");
    assert.equal(parseJiraRef("https://acme.atlassian.net/jira/software/projects/ABC/boards/1"), "ABC");
    assert.throws(() => parseJiraRef("https://acme.atlassian.net/wiki"), InvalidCliInputError);
});

test("parseConfluenceRef / parsePageId handle ids and URLs", () => {
    assert.deepEqual(parseConfluenceRef("ENG"), { value: "ENG" });
    assert.deepEqual(parseConfluenceRef("https://a.atlassian.net/wiki/spaces/ENG/pages/12345/Title"), { id: "12345", space: "ENG" });
    assert.deepEqual(parseConfluenceRef("https://a.atlassian.net/wiki/spaces/ENG/folder/777"), { id: "777", space: "ENG" });
    assert.deepEqual(parseConfluenceRef("https://a.atlassian.net/wiki/spaces/ENG/overview"), { id: undefined, space: "ENG" });
    assert.throws(() => parseConfluenceRef("https://a.atlassian.net/wiki/home"), InvalidCliInputError);
    assert.equal(parsePageId("12345"), "12345");
    assert.equal(parsePageId("https://a.atlassian.net/wiki/spaces/ENG/pages/12345/Title"), "12345");
    assert.throws(() => parsePageId("https://a.atlassian.net/wiki/spaces/ENG/overview"), InvalidCliInputError);
});

test("parsePrRef handles numbers and GitHub URLs", () => {
    assert.deepEqual(parsePrRef("42"), { pr: "42" });
    assert.deepEqual(parsePrRef("https://github.com/acme/widget/pull/42/files"), { repo: "acme/widget", pr: "42" });
    assert.throws(() => parsePrRef("https://github.com/acme/widget/issues/42"), InvalidCliInputError);
});

test("resolveProject prefers ticket id, then explicit, then config", () => {
    const config = { jira: { project: "CFG" } };
    assert.equal(resolveProject({ ticketId: "ABC-1", explicit: "X", config }), "ABC");
    assert.equal(resolveProject({ explicit: "X", config }), "X");
    assert.equal(resolveProject({ config }), "CFG");
});

test("resolveProject fails when nothing supplies a project, including a blank config value", () => {
    assert.throws(() => resolveProject({ config: {} }), InvalidCliInputError);
    assert.throws(() => resolveProject({ config: { jira: { project: "" } } }), InvalidCliInputError);
});

test("resolveSpace prefers explicit over config and fails when absent", () => {
    assert.equal(resolveSpace({ explicit: "ENG", config: { confluence: { space: "OPS" } } }), "ENG");
    assert.equal(resolveSpace({ config: { confluence: { space: "OPS" } } }), "OPS");
    assert.throws(() => resolveSpace({ config: { confluence: { space: "" } } }), InvalidCliInputError);
});
