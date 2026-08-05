import { stringify as stringifyYaml } from "yaml";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createJiraClient, createJiraAgileClient } from "../../shared/jira-client.js";
import { write } from "../../shared/output/file.js";

const PAGE_SIZE = 50;

// Orchestrates: collect a project's assignable users and its boards (each with
// its sprints), then emit one YAML reference file mapping names to the ids used
// by the assignee and sprint fields.
export async function fetchProject({ project, out, config }) {
    resolveAtlassian(config);
    const client = createJiraClient(config);
    const agile = createJiraAgileClient(config);

    const people = (await fetchAssignableUsers(client, project)).map(toPerson);

    const boards = [];
    for (const board of await fetchBoards(agile, project)) {
        const sprints = (await fetchSprints(agile, board.id)).map(toSprint);
        boards.push(toBoard(board, sprints));
    }

    await write(out, stringifyYaml({ people, boards }));
}

// /user/assignable/search returns a bare User[]; page until a short page.
async function fetchAssignableUsers(client, project) {
    const users = [];
    let startAt = 0;
    for (;;) {
        const page = await client.userSearch.findAssignableUsers({
            project,
            startAt,
            maxResults: PAGE_SIZE,
        });
        const batch = page ?? [];
        users.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        startAt += batch.length;
    }
    return users;
}

// Agile board/sprint endpoints wrap results in { values, isLast }.
async function fetchBoards(agile, project) {
    return collectPaged((startAt) =>
        agile.board.getAllBoards({ projectKeyOrId: project, startAt, maxResults: PAGE_SIZE }),
    );
}

async function fetchSprints(agile, boardId) {
    return collectPaged((startAt) =>
        agile.board.getAllSprints({ boardId, startAt, maxResults: PAGE_SIZE }),
    );
}

async function collectPaged(getPage) {
    const items = [];
    let startAt = 0;
    for (;;) {
        const page = await getPage(startAt);
        const values = page?.values ?? [];
        items.push(...values);
        if (page?.isLast || values.length === 0) break;
        startAt += values.length;
    }
    return items;
}

// Pure mappers, exported for unit testing.
export function toPerson(user) {
    return { name: user.displayName ?? "", id: user.accountId ?? null };
}

export function toSprint(sprint) {
    return { name: sprint.name ?? "", id: sprint.id ?? null };
}

export function toBoard(board, sprints) {
    return { name: board.name ?? "", id: board.id ?? null, sprints };
}
