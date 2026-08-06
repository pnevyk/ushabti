import { InvalidCliInputError } from "../../shared/errors.js";
import { createGithubClient } from "../../shared/github-client.js";
import { currentRepo } from "../../shared/git.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";

// Orchestrates: search merged PRs in [since, until], fetch each PR's reviews,
// inline review comments and conversation comments, serialize, write to `out`.
export async function fetchDigest({ since, until, repo, out, config }) {
    if (repo == null) {
        try {
            repo = currentRepo();
        } catch {
            throw new InvalidCliInputError(
                "A repository is required to build the digest, and none could be determined from git. Use --repo <owner/name>.",
            );
        }
    }
    const [owner, name] = repo.split("/");
    const client = createGithubClient(config);

    const q = buildSearchQuery({ owner, name, since, until });
    const items = await client.paginate(client.rest.search.issuesAndPullRequests, { q, per_page: 100 });

    const pullRequests = [];
    for (const item of items) {
        const [reviews, reviewComments, comments] = await Promise.all([
            client.paginate(client.rest.pulls.listReviews, {
                owner,
                repo: name,
                pull_number: item.number,
                per_page: 100,
            }),
            client.paginate(client.rest.pulls.listReviewComments, {
                owner,
                repo: name,
                pull_number: item.number,
                per_page: 100,
            }),
            client.paginate(client.rest.issues.listComments, {
                owner,
                repo: name,
                issue_number: item.number,
                per_page: 100,
            }),
        ]);
        pullRequests.push(toPrEntry(item, { reviews, reviewComments, comments }));
    }

    await write(out, serialize({ repo: `${owner}/${name}`, since, until, pullRequests }));
}

// Pure: build a GitHub search query for merged PRs within the date window.
// Exported for unit testing.
export function buildSearchQuery({ owner, name, since, until }) {
    let q = `repo:${owner}/${name} is:pr is:merged`;
    if (since && until) {
        q += ` merged:${since}..${until}`;
    } else if (since) {
        q += ` merged:>=${since}`;
    } else if (until) {
        q += ` merged:<=${until}`;
    }
    return q;
}

// Pure: accept YYYY-MM-DD or an ISO datetime (optional time, optional Z/offset).
// GitHub silently ignores malformed `merged:` qualifiers, so callers validate.
export function isValidDate(s) {
    return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/.test(s);
}

// Pure transform: a search item plus its fetched comment streams -> digest entry.
// Exported for unit testing without touching the network.
export function toPrEntry(item, { reviews, reviewComments, comments }) {
    return {
        number: item.number,
        title: item.title,
        author: item.user?.login ?? null,
        createdAt: item.created_at,
        mergedAt: item.pull_request?.merged_at ?? null,
        url: item.html_url,
        body: item.body ?? null,
        reviews: reviews
            .filter((review) => review.state !== "PENDING")
            .map((review) => ({
                author: review.user?.login ?? null,
                state: review.state,
                body: review.body ?? null,
                submittedAt: review.submitted_at,
            })),
        reviewComments: reviewComments.map((comment) => ({
            path: comment.path,
            line: comment.line ?? comment.original_line ?? null,
            body: comment.body,
            author: comment.user?.login ?? null,
            createdAt: comment.created_at,
            diffHunk: comment.diff_hunk,
        })),
        comments: comments.map((comment) => ({
            body: comment.body,
            author: comment.user?.login ?? null,
            createdAt: comment.created_at,
        })),
    };
}
