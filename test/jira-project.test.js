import { test } from "node:test";
import assert from "node:assert/strict";
import { toPerson, toSprint, toBoard } from "../src/features/jira-project/service.js";

test("toPerson maps displayName and accountId", () => {
    assert.deepEqual(toPerson({ displayName: "Jane Doe", accountId: "acc-1" }), {
        name: "Jane Doe",
        id: "acc-1",
    });
});

test("toPerson nulls missing accountId and empties missing name", () => {
    assert.deepEqual(toPerson({}), { name: "", id: null });
});

test("toSprint maps name and id", () => {
    assert.deepEqual(toSprint({ name: "Sprint 12", id: 12 }), { name: "Sprint 12", id: 12 });
});

test("toSprint nulls missing id and empties missing name", () => {
    assert.deepEqual(toSprint({}), { name: "", id: null });
});

test("toBoard maps name, id and nests sprints", () => {
    const sprints = [{ name: "Sprint 12", id: 12 }];
    assert.deepEqual(toBoard({ name: "ABC Scrum Board", id: 1 }, sprints), {
        name: "ABC Scrum Board",
        id: 1,
        sprints,
    });
});

test("toBoard nulls missing id and empties missing name", () => {
    assert.deepEqual(toBoard({}, []), { name: "", id: null, sprints: [] });
});
