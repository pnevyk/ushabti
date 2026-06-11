import { test } from "node:test";
import assert from "node:assert/strict";
import { toUpdateFields } from "../src/features/jira-update/service.js";
import { CliError } from "../src/shared/errors.js";

test("toUpdateFields maps present fields with ADF description", () => {
    const fields = toUpdateFields({
        data: { title: "Do it", type: "Task" },
        body: "Hello",
        spField: null,
    });
    assert.equal(fields.summary, "Do it");
    assert.equal(fields.issuetype.name, "Task");
    assert.equal(fields.description.type, "doc");
    assert.equal(fields.description.content[0].content[0].text, "Hello");
});

test("toUpdateFields includes optional parent, assignee, story points", () => {
    const fields = toUpdateFields({
        data: { title: "t", parent: "ABC-100", assignee: "acc-1", storyPoints: 3 },
        body: "",
        spField: "customfield_10016",
    });
    assert.deepEqual(fields.parent, { key: "ABC-100" });
    assert.deepEqual(fields.assignee, { accountId: "acc-1" });
    assert.equal(fields.customfield_10016, 3);
});

test("toUpdateFields omits absent optional fields", () => {
    const fields = toUpdateFields({ data: { title: "t" }, body: "", spField: null });
    assert.equal("issuetype" in fields, false);
    assert.equal("description" in fields, false);
    assert.equal("parent" in fields, false);
    assert.equal("assignee" in fields, false);
});

test("toUpdateFields omits story points when no field configured", () => {
    const fields = toUpdateFields({ data: { title: "t", storyPoints: 3 }, body: "", spField: null });
    assert.equal("customfield_10016" in fields, false);
});

test("toUpdateFields throws when there is nothing to update", () => {
    assert.throws(() => toUpdateFields({ data: {}, body: "", spField: null }), CliError);
    assert.throws(() => toUpdateFields({ data: { id: "ABC-1" }, body: "", spField: null }), CliError);
});
