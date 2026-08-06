import { serviceLabel, secretsHint } from "./error-signals.js";

export class UshabtiError extends Error {
    constructor({ message, cause, exitCode = 1 } = {}) {
        super(message, { cause });
        this.name = this.constructor.name;
        this.exitCode = exitCode;
    }
}

// The user's/their config's fault, not an external system's. Message is
// freeform per call site -- there's no structured data to build a template
// from, the message itself is the payload.
export class UsageError extends UshabtiError {
    constructor(message) {
        super({ message });
    }
}

// Bad or missing CLI flags, unknown command/subcommand.
export class InvalidCliInputError extends UsageError {}

// Config file absent, or a required key/token is missing.
export class MissingConfigError extends UsageError {}

// A config value is present but semantically wrong.
export class InvalidConfigError extends UsageError {}

// A domain precondition is violated (bad frontmatter, ambiguous PR, ...).
export class ValidationError extends UsageError {}

export class NotImplementedError extends UsageError {
    constructor(what) {
        super(`Not implemented: ${what}`);
        this.exitCode = 2;
    }
}

// A call to GitHub/Jira/Confluence/local file I/O failed. Always carries
// `service` and, where one exists, the original error as `cause`. This is
// the type the top-level handler checks to decide whether to write the
// debug log.
export class IoError extends UshabtiError {
    constructor({ service, cause, message, exitCode }) {
        super({ message, cause, exitCode });
        this.service = service;
    }
}

export class AuthenticationError extends IoError {
    constructor({ service, cause }) {
        super({
            service,
            cause,
            message: `${serviceLabel(service)} rejected the request: your token is missing or invalid. Run \`ushabti secrets set ${secretsHint(service)}\` to update it.`,
        });
    }
}

export class PermissionError extends IoError {
    constructor({ service, cause, resource }) {
        const target = resource ? ` for ${resource}` : "";
        super({
            service,
            cause,
            message: `${serviceLabel(service)} rejected the request: your token doesn't have permission${target}. Check the token's scopes.`,
        });
        this.resource = resource;
    }
}

export class NotFoundError extends IoError {
    constructor({ service, cause, resource }) {
        const base = `${serviceLabel(service)} couldn't find ${resource ?? "the requested resource"}.`;
        // Jira returns 404 for both a genuinely missing resource and an
        // invalid token, with no way to tell the two apart from the response.
        const message =
            service === "jira"
                ? `${base} If it actually exists, make sure that your Atlassian token is valid. Run \`ushabti secrets set ${secretsHint(service)}\` to update it if needed.`
                : base;
        super({ service, cause, message });
        this.resource = resource;
    }
}

export class RateLimitedError extends IoError {
    constructor({ service, cause, retryAfterMs }) {
        const wait = retryAfterMs ? `Wait ${Math.ceil(retryAfterMs / 1000)}s and try again.` : "Wait a bit and try again.";
        super({ service, cause, message: `${serviceLabel(service)} is rate-limiting requests. ${wait}` });
        this.retryAfterMs = retryAfterMs;
    }
}

export class ServiceUnavailableError extends IoError {
    constructor({ service, cause }) {
        super({
            service,
            cause,
            message: `${serviceLabel(service)} is having problems right now. This isn't something you can fix on your end -- wait a bit and try again.`,
        });
    }
}

export class ConnectionError extends IoError {
    constructor({ service, cause, code }) {
        super({ service, cause, message: `Couldn't connect to ${serviceLabel(service)} (${code}). Check your network connection.` });
        this.code = code;
    }
}

export class UnexpectedIoError extends IoError {
    constructor({ service, cause }) {
        super({ service, cause, message: `${serviceLabel(service)} returned an unexpected error: ${cause?.message ?? "no details available"}.` });
    }
}
