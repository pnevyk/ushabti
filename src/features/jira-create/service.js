import { NotImplementedError } from "../../shared/errors.js";

// Orchestrates: read markdown file, map to a Jira issue, create via API.
// Uses shared/jira-client.js.
export async function createTicket(/* { file, config } */) {
    throw new NotImplementedError("jira create");
}
