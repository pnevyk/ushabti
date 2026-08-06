import {
    AuthError,
    ForbiddenError,
    NotFoundError as ConfluenceNotFoundError,
    RateLimitError,
    ServerError,
    NetworkError as ConfluenceNetworkError,
} from "confluence.js";
import {
    AuthenticationError,
    PermissionError,
    NotFoundError,
    RateLimitedError,
    ServiceUnavailableError,
    ConnectionError,
    UnexpectedIoError,
} from "./errors.js";

// confluence.js already exposes typed errors, so classification is
// `instanceof` dispatch against its own hierarchy instead of guessing from
// a status code -- including NetworkError for "no response at all" (DNS,
// TLS, reset, timeout), which already carries `.code`.
export function toConfluenceError(err, extra = {}) {
    if (err instanceof RateLimitError) return new RateLimitedError({ service: "confluence", cause: err, retryAfterMs: err.retryAfterMs, ...extra });
    if (err instanceof AuthError) return new AuthenticationError({ service: "confluence", cause: err, ...extra });
    if (err instanceof ForbiddenError) return new PermissionError({ service: "confluence", cause: err, ...extra });
    if (err instanceof ConfluenceNotFoundError) return new NotFoundError({ service: "confluence", cause: err, ...extra });
    if (err instanceof ServerError) return new ServiceUnavailableError({ service: "confluence", cause: err, ...extra });
    if (err instanceof ConfluenceNetworkError) return new ConnectionError({ service: "confluence", cause: err, code: err.code ?? "unknown", ...extra });
    return new UnexpectedIoError({ service: "confluence", cause: err, ...extra });
}
