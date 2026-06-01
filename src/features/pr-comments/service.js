import { requireKeys } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createGithubClient } from "../../shared/github-client.js";
import { currentRepo, currentBranch } from "../../shared/git.js";
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
// keep unresolved (or all when `all`), serialize, write to `out`.
export async function fetchComments({ repo, pr, out, all, config }) {
    requireKeys(config, ["github.token"]);

    if (repo == null) {
        try {
            repo = currentRepo();
        } catch {
            throw new CliError("Could not determine repo from git; pass --repo <owner/name>");
        }
    }
    const [owner, name] = repo.split("/");
    const client = createGithubClient(config);

    if (pr == null) {
        pr = await resolvePrForBranch(client, owner, name);
    }

    const nodes = [];
    let cursor = null;
    do {
        const result = await client.graphql(QUERY, { owner, name, number: pr, cursor });
        const threads = result.repository.pullRequest.reviewThreads;
        nodes.push(...threads.nodes);
        cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
    } while (cursor);

    const threads = toThreads(nodes, all);
    await write(out, serialize({ threads }));
}

// Find the sole open PR whose head branch is the current git branch.
async function resolvePrForBranch(client, owner, name) {
    let branch;
    try {
        branch = currentBranch();
    } catch {
        throw new CliError("Could not determine branch from git; pass --pr <n>");
    }
    const prs = await client.paginate(client.rest.pulls.list, {
        owner,
        repo: name,
        state: "open",
        per_page: 100,
    });
    return pickPr(prs, branch);
}

// Pure: select the unique open PR matching the branch. Exported for tests.
export function pickPr(prs, branch) {
    const matches = prs.filter((pr) => pr.head.ref === branch);
    if (matches.length === 0) {
        throw new CliError(`No open PR found for branch ${branch}`);
    }
    if (matches.length > 1) {
        throw new CliError(`Multiple open PRs for branch ${branch}; pass --pr <n>`);
    }
    return matches[0].number;
}

// Pure transform: GraphQL reviewThreads.nodes -> minimal thread objects.
// Exported for unit testing without touching the network.
export function toThreads(nodes, includeResolved) {
    return nodes
        .filter((node) => includeResolved || !node.isResolved)
        .map((node) => {
            const endLine = node.line ?? node.originalLine ?? null;
            const startLine = node.startLine ?? node.originalStartLine ?? endLine;
            return {
                path: node.path ?? null,
                resolved: node.isResolved,
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
