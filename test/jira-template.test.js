import { test } from "node:test";
import assert from "node:assert/strict";
import { jiraTemplate } from "../src/features/jira-template/service.js";
import { parse } from "../src/shared/frontmatter.js";

test("jiraTemplate has required fields uncommented and parses as frontmatter", () => {
    const template = jiraTemplate();
    const { data, body } = parse(template);
    assert.equal(data.title, "Placeholder title");
    assert.equal(data.type, "Story");
    assert.match(body, /Placeholder description/);
});

test("jiraTemplate comments out optional fields", () => {
    const template = jiraTemplate();
    assert.match(template, /^# parent:/m);
    assert.match(template, /^# assignee:/m);
    assert.match(template, /^# storyPoints:/m);
    assert.match(template, /^# sprint:/m);
    const { data } = parse(template);
    assert.equal(data.parent, undefined);
    assert.equal(data.assignee, undefined);
    assert.equal(data.storyPoints, undefined);
    assert.equal(data.sprint, undefined);
});
