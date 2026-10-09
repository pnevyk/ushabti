import { InvalidCliInputError } from "./errors.js";

const TICKET_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

export function warnDeprecated(message) {
    console.error(`warning: ${message}`);
}

export function isTicketKey(value) {
    return TICKET_KEY.test(value);
}

export function projectOfKey(key) {
    return key.slice(0, key.lastIndexOf("-"));
}

// Fails on surplus positionals instead of silently ignoring them.
export function expectPositionals(positionals, max, usage) {
    if (positionals.length > max) {
        throw new InvalidCliInputError(`Unexpected argument: ${positionals[max]}. Usage: ${usage}`);
    }
}

// A command's main subject arrives as a positional; the legacy flag still
// works but warns. Both given with different values is ambiguous.
export function pickSubject({ positional, flagValue, flagName, hint }) {
    if (flagValue == null) {
        return positional;
    }
    if (positional != null && positional !== flagValue) {
        throw new InvalidCliInputError(`${flagName} (${flagValue}) conflicts with the argument ${positional}. Pass only one, preferably the argument.`);
    }
    warnDeprecated(`${flagName} is deprecated and will be removed in a future release. ${hint}`);
    return positional ?? flagValue;
}

function toUrl(value) {
    try {
        return new URL(value);
    } catch {
        throw new InvalidCliInputError(`${value} is neither a plain value nor a valid URL.`);
    }
}

function isUrl(value) {
    return /^https?:\/\//i.test(value);
}

function segmentAfter(segments, name) {
    const i = segments.indexOf(name);
    return i >= 0 ? segments[i + 1] : undefined;
}

// Bare Jira ticket/project key, or a URL carrying one (browse page, board
// with ?selectedIssue=, project page). Returns the key.
export function parseJiraRef(value) {
    if (!isUrl(value)) {
        return value;
    }
    const url = toUrl(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const key = segmentAfter(segments, "browse") ?? url.searchParams.get("selectedIssue") ?? segmentAfter(segments, "projects");
    if (!key) {
        throw new InvalidCliInputError(`No Jira ticket or project key was found in ${value}. Pass the key itself, e.g. ABC-123.`);
    }
    return key;
}

// Bare page id / space key, or a Confluence URL. Returns { id?, space? }:
// .../spaces/ENG/pages/12345/Title or .../spaces/ENG/folder/12345.
export function parseConfluenceRef(value) {
    if (!isUrl(value)) {
        return { value };
    }
    const segments = toUrl(value).pathname.split("/").filter(Boolean);
    const id = segmentAfter(segments, "pages") ?? segmentAfter(segments, "folder");
    const space = segmentAfter(segments, "spaces");
    if (!id && !space) {
        throw new InvalidCliInputError(`No Confluence page id or space key was found in ${value}.`);
    }
    return { id, space };
}

// Bare PR number, or a GitHub PR URL. Returns { repo?, pr }.
export function parsePrRef(value) {
    if (!isUrl(value)) {
        return { pr: value };
    }
    const match = toUrl(value).pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) {
        throw new InvalidCliInputError(`No pull request was found in ${value}. Expected https://github.com/<owner>/<name>/pull/<n>.`);
    }
    return { repo: `${match[1]}/${match[2]}`, pr: match[3] };
}

// Jira project: from a ticket id, else explicit, else config.
export function resolveProject({ ticketId, explicit, config }) {
    if (ticketId) return projectOfKey(ticketId);
    const project = explicit ?? (config?.jira?.project || undefined);
    if (!project) {
        throw new InvalidCliInputError("A Jira project key is required. Pass it as an argument (e.g. ABC), or set `project` under [jira] in the config.");
    }
    return project;
}

// Confluence space: explicit, else config.
export function resolveSpace({ explicit, config }) {
    const space = explicit ?? (config?.confluence?.space || undefined);
    if (!space) {
        throw new InvalidCliInputError("A Confluence space key is required. Pass it as an argument (e.g. ENG), or set `space` under [confluence] in the config.");
    }
    return space;
}

// Page/folder id from a bare id or a Confluence URL.
export function parsePageId(value) {
    const ref = parseConfluenceRef(value);
    const id = ref.id ?? ref.value;
    if (!id) {
        throw new InvalidCliInputError(`No Confluence page id was found in ${value}.`);
    }
    return id;
}
