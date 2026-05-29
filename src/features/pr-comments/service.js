import { requireKeys } from "../../shared/config.js";
import { createGithubClient } from "../../shared/github-client.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";

const QUERY = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
            reviewThreads(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                    isResolved
                    path
                    line
                    startLine
                    originalLine
                    originalStartLine
                    comments(first: 100) {
                        nodes {
                            body
                            author { login }
                            createdAt
                            diffHunk
                        }
                    }
                }
            }
        }
    }
}`;

// Orchestrates: fetch all PR review threads via GitHub GraphQL (paginated),
// keep unresolved, serialize, write to `out`.
export async function fetchUnresolvedComments({ repo, pr, out, config }) {
    requireKeys(config, ["github.token"]);
    const [owner, name] = repo.split("/");
    const client = createGithubClient(config);

    const nodes = [];
    let cursor = null;
    do {
        const result = await client.graphql(QUERY, { owner, name, number: pr, cursor });
        const threads = result.repository.pullRequest.reviewThreads;
        nodes.push(...threads.nodes);
        cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
    } while (cursor);

    const threads = toThreads(nodes);
    await write(out, serialize({ threads }));
}

// Pure transform: GraphQL reviewThreads.nodes -> minimal thread objects.
// Exported for unit testing without touching the network.
export function toThreads(nodes) {
    return nodes
        .filter((node) => !node.isResolved)
        .map((node) => {
            const endLine = node.line ?? node.originalLine ?? null;
            const startLine = node.startLine ?? node.originalStartLine ?? endLine;
            return {
                path: node.path ?? null,
                startLine,
                endLine,
                diffHunk: node.comments.nodes[0]?.diffHunk ?? null,
                comments: node.comments.nodes.map((comment) => ({
                    body: comment.body,
                    author: comment.author?.login ?? null,
                    createdAt: comment.createdAt,
                })),
            };
        });
}
