import { test } from "node:test";
import assert from "node:assert/strict";
import { toIssueFields, applyCreatedId } from "../src/features/jira-create/service.js";
import { parse } from "../src/shared/frontmatter.js";
import { CliError } from "../src/shared/errors.js";

test("toIssueFields builds required fields with ADF description", () => {
    const fields = toIssueFields({
        data: { title: "Do it", type: "Task" },
        body: "Hello",
        project: "ABC",
        spField: null,
    });
    assert.equal(fields.project.key, "ABC");
    assert.equal(fields.issuetype.name, "Task");
    assert.equal(fields.summary, "Do it");
    assert.equal(fields.description.type, "doc");
    assert.equal(fields.description.content[0].content[0].text, "Hello");
});

test("toIssueFields includes optional parent, assignee, story points", () => {
    const fields = toIssueFields({
        data: { title: "t", type: "Story", parent: "ABC-100", assignee: "acc-1", storyPoints: 3 },
        body: "",
        project: "ABC",
        spField: "customfield_10016",
    });
    assert.deepEqual(fields.parent, { key: "ABC-100" });
    assert.deepEqual(fields.assignee, { accountId: "acc-1" });
    assert.equal(fields.customfield_10016, 3);
});

test("toIssueFields omits story points when no field configured", () => {
    const fields = toIssueFields({
        data: { title: "t", type: "Story", storyPoints: 3 },
        body: "",
        project: "ABC",
        spField: null,
    });
    assert.equal("customfield_10016" in fields, false);
});

test("toIssueFields requires title and type", () => {
    assert.throws(() => toIssueFields({ data: { type: "Task" }, body: "", project: "ABC", spField: null }), CliError);
    assert.throws(() => toIssueFields({ data: { title: "t" }, body: "", project: "ABC", spField: null }), CliError);
});

test("applyCreatedId sets id as the first frontmatter field and preserves body", () => {
    const content = applyCreatedId({ data: { title: "Do it", type: "Task" }, body: "Hello", key: "ABC-1" });
    assert.match(content, /^---\nid: ABC-1\n/);
    const { data, body } = parse(content);
    assert.equal(data.id, "ABC-1");
    assert.equal(data.title, "Do it");
    assert.equal(data.type, "Task");
    assert.equal(body, "Hello");
});

test("applyCreatedId overrides a pre-existing id", () => {
    const content = applyCreatedId({ data: { id: "OLD-9", title: "t", type: "Task" }, body: "", key: "ABC-2" });
    const { data } = parse(content);
    assert.equal(data.id, "ABC-2");
});
