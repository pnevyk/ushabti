import { NotImplementedError } from "../../shared/errors.js";

// Orchestrates: query Jira tickets for a project, serialize, write to `out`.
// Uses shared/jira-client.js and shared/output/*.
export async function fetchTickets(/* { project, out, config } */) {
    throw new NotImplementedError("jira fetch");
}
