export class CliError extends Error {
    constructor(message, exitCode = 1) {
        super(message);
        this.name = "CliError";
        this.exitCode = exitCode;
    }
}

export class NotImplementedError extends CliError {
    constructor(what) {
        super(`Not implemented: ${what}`, 2);
        this.name = "NotImplementedError";
    }
}
