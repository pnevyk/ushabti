// Pure, non-throwing helpers for reading failure signals off a raw caught
// error. Called inline from catch blocks and error constructors -- never
// wrap a throw, so they never show up in a domain error's own stack trace.

export function httpStatus(err) {
    return err.status ?? err.response?.status;
}

export function networkErrorCode(err) {
    return err.code ?? err.cause?.code;
}

const SERVICE_LABELS = {
    github: "GitHub",
    jira: "Jira",
    confluence: "Confluence",
    config: "Your config file",
};

export function serviceLabel(service) {
    return SERVICE_LABELS[service] ?? service;
}

// Matches `ushabti secrets set <github|atlassian>` -- jira and confluence
// share one set of Atlassian credentials.
const SECRETS_HINTS = {
    github: "github",
    jira: "atlassian",
    confluence: "atlassian",
};

export function secretsHint(service) {
    return SECRETS_HINTS[service] ?? service;
}
