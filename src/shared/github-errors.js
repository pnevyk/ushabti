import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "./errors.js";
import { httpStatus, networkErrorCode } from "./error-signals.js";

// Maps a raw error from an Octokit call (REST `RequestError`, always
// `.status`; GraphQL `GraphqlResponseError`, a 200 response with no
// `.status` at all) to the matching IoError subtype. `extra` carries
// call-specific detail, typically `{ resource }`.
export function toGithubError(err, extra = {}) {
    const status = httpStatus(err);
    if (status === 401) return new AuthenticationError({ service: "github", cause: err, ...extra });
    if (status === 403) return new PermissionError({ service: "github", cause: err, ...extra });
    if (status === 404) return new NotFoundError({ service: "github", cause: err, ...extra });
    if (status === 429) return new RateLimitedError({ service: "github", cause: err, ...extra });
    if (status >= 500) return new ServiceUnavailableError({ service: "github", cause: err, ...extra });
    const code = networkErrorCode(err);
    if (code) return new ConnectionError({ service: "github", cause: err, code, ...extra });
    // No status and no network code: a GraphQL-level error (bad repo/PR
    // reference, etc.) -- its own message is surfaced via `cause.message`.
    return new UnexpectedIoError({ service: "github", cause: err, ...extra });
}
