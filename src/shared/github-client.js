import { Octokit } from "octokit";
import { resolveSecret } from "./secrets.js";
import { CliError } from "./errors.js";

// Umbrella client exposes both REST (.rest) and GraphQL (.graphql). Unresolved
// review threads are only available via GraphQL (reviewThreads.isResolved).
export function createGithubClient(config) {
    const token = resolveSecret(config, "github.token");
    if (!token) {
        throw new CliError("Missing config keys: github.token");
    }
    return new Octokit({ auth: token });
}
