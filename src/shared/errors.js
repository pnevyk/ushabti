// Deprecated: superseded by UshabtiError below. Kept only for the two
// remaining call sites that depend on an awaited network call's result
// inline (confluence-create's space lookup, confluence-download's
// attachment fetch) -- they reclassify to IoError once it lands.
export class CliError extends Error {
    constructor(message, exitCode = 1) {
        super(message);
        this.name = "CliError";
        this.exitCode = exitCode;
    }
}

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
