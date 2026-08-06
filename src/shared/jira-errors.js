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

// jira.js's HttpException always carries `.status` (defaulting to 500 when
// the library itself doesn't know), so classification is a flat status
// switch, same shape as GitHub's REST case.
export function toJiraError(err, extra = {}) {
    const status = httpStatus(err);
    if (status === 401) return new AuthenticationError({ service: "jira", cause: err, ...extra });
    if (status === 403) return new PermissionError({ service: "jira", cause: err, ...extra });
    if (status === 404) return new NotFoundError({ service: "jira", cause: err, ...extra });
    if (status === 429) return new RateLimitedError({ service: "jira", cause: err, ...extra });
    if (status >= 500) return new ServiceUnavailableError({ service: "jira", cause: err, ...extra });
    const code = networkErrorCode(err);
    if (code) return new ConnectionError({ service: "jira", cause: err, code, ...extra });
    return new UnexpectedIoError({ service: "jira", cause: err, ...extra });
}
