import { Octokit } from "octokit";
import { resolveSecret } from "./secrets.js";
import { MissingConfigError } from "./errors.js";

// Umbrella client exposes both REST (.rest) and GraphQL (.graphql). Unresolved
// review threads are only available via GraphQL (reviewThreads.isResolved).
export function createGithubClient(config) {
    const token = resolveSecret(config, "github.token");
    if (!token) {
        throw new MissingConfigError("A GitHub token is required to communicate with GitHub. Use `ushabti secrets set github` to store one.");
    }
    return new Octokit({ auth: token });
}
