import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { CliError } from "../../shared/errors.js";
import { parse } from "../../shared/frontmatter.js";

// Fields exposed as identifiers inside a --where expression.
export const FIELDS = ["id", "title", "type", "parent", "assignee", "storyPoints"];

// Orchestrates: load locally fetched tickets, keep those matching `where`,
// return their ids (or filename stem for drafts without an id).
export async function filterTickets({ inPath, where }) {
    const tickets = await loadTickets(inPath);
    const predicate = compilePredicate(where);
    return tickets.filter((t) => predicate(t.fields)).map((t) => t.name);
}

// Load tickets from a markdown directory (per-ticket frontmatter) or a JSON
// file ({tickets:[...]}), detected by stat. Returns [{fields, name}].
export async function loadTickets(inPath) {
    let info;
    try {
        info = await stat(inPath);
    } catch {
        throw new CliError(`Input not found: ${inPath}`);
    }

    if (info.isDirectory()) {
        const names = (await readdir(inPath)).filter((n) => n.endsWith(".md"));
        const tickets = [];
        for (const name of names) {
            const { data } = parse(await readFile(join(inPath, name), "utf8"));
            tickets.push({ fields: data, name: data.id ?? basename(name, ".md") });
        }
        return tickets;
    }

    const parsed = JSON.parse(await readFile(inPath, "utf8"));
    const list = parsed.tickets ?? [];
    return list.map((fields) => ({ fields, name: fields.id }));
}

// Pure: compile a --where expression into (fields) -> boolean. A missing
// expression matches everything. Exported for unit testing.
export function compilePredicate(where) {
    if (!where) {
        return () => true;
    }

    let fn;
    try {
        fn = new Function(...FIELDS, `"use strict"; return (${where});`);
    } catch (err) {
        throw new CliError(`Invalid --where expression: ${err.message}`);
    }

    return (fields) => {
        try {
            return Boolean(fn(...FIELDS.map((f) => fields[f])));
        } catch (err) {
            throw new CliError(`Error evaluating --where: ${err.message}`);
        }
    };
}
