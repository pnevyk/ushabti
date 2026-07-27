import { test } from "node:test";
import assert from "node:assert/strict";
import { confluenceTemplate } from "../src/features/confluence-template/service.js";
import { parse } from "../src/shared/frontmatter.js";

test("confluenceTemplate has required fields uncommented and parses as frontmatter", () => {
    const template = confluenceTemplate();
    const { data, body } = parse(template);
    assert.equal(data.title, "Placeholder title");
    assert.match(body, /Placeholder page content/);
});

test("confluenceTemplate comments out optional fields", () => {
    const template = confluenceTemplate();
    assert.match(template, /^# parentId:/m);
    assert.match(template, /^# type:/m);
    const { data } = parse(template);
    assert.equal(data.parentId, undefined);
    assert.equal(data.type, undefined);
});
