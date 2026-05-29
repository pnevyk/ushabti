import { NotImplementedError } from "../../shared/errors.js";

// Orchestrates: fetch PR review threads via GitHub GraphQL, keep unresolved,
// serialize, write to `out`. Uses shared/github-client.js and shared/output/*.
export async function fetchUnresolvedComments(/* { repo, pr, out, config } */) {
    throw new NotImplementedError("pr comments");
}
