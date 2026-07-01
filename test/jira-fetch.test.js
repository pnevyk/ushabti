import { test } from "node:test";
import assert from "node:assert/strict";
import { toTicket } from "../src/features/jira-fetch/service.js";

const issue = (fields) => ({ key: "ABC-1", fields });

test("toTicket maps standard fields", () => {
    const ticket = toTicket(issue({
        summary: "Do the thing",
        issuetype: { name: "Story" },
        parent: { key: "ABC-100" },
        assignee: { accountId: "acc-1" },
        description: { version: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "desc" }] }] },
    }), null);

    assert.deepEqual(ticket, {
        id: "ABC-1",
        title: "Do the thing",
        type: "Story",
        parent: "ABC-100",
        assignee: "acc-1",
        description: "desc",
    });
});

test("toTicket nulls missing optional fields", () => {
    const ticket = toTicket(issue({ summary: "x" }), null);
    assert.equal(ticket.type, null);
    assert.equal(ticket.parent, null);
    assert.equal(ticket.assignee, null);
    assert.equal(ticket.description, "");
    assert.equal("storyPoints" in ticket, false);
});

test("toTicket includes story points only when field configured", () => {
    const fields = { summary: "x", customfield_10016: 5 };
    assert.equal(toTicket(issue(fields), "customfield_10016").storyPoints, 5);
    assert.equal("storyPoints" in toTicket(issue(fields), null), false);
});

test("toTicket splits sprint into current and history", () => {
    const fields = {
        summary: "x",
        customfield_10020: [{ id: 12, name: "S12" }, { id: 13, name: "S13" }, { id: 15, name: "S15" }],
    };
    const ticket = toTicket(issue(fields), null, "customfield_10020");
    assert.equal(ticket.sprint, 15);
    assert.deepEqual(ticket.sprintHistory, [12, 13]);
});

test("toTicket omits sprint history for a single sprint", () => {
    const fields = { summary: "x", customfield_10020: [{ id: 15, name: "S15" }] };
    const ticket = toTicket(issue(fields), null, "customfield_10020");
    assert.equal(ticket.sprint, 15);
    assert.equal(ticket.sprintHistory, null);
});

test("toTicket nulls sprint when field configured but absent", () => {
    const ticket = toTicket(issue({ summary: "x" }), null, "customfield_10020");
    assert.equal(ticket.sprint, null);
    assert.equal(ticket.sprintHistory, null);
});

test("toTicket omits sprint when field not configured", () => {
    const ticket = toTicket(issue({ summary: "x", customfield_10020: [{ id: 15 }] }), null, null);
    assert.equal("sprint" in ticket, false);
    assert.equal("sprintHistory" in ticket, false);
});
