import { Octokit } from "octokit";

// Umbrella client exposes both REST (.rest) and GraphQL (.graphql). Unresolved
// review threads are only available via GraphQL (reviewThreads.isResolved).
export function createGithubClient(config) {
    return new Octokit({ auth: config.github.token });
}
