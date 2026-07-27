// Pure: filesystem-safe slug from a Confluence title. Strips characters
// illegal in file/directory names, collapses whitespace and repeated
// separators, and caps length. All-illegal or blank input yields "".
export function sanitizeTitle(title) {
    const slug = (title ?? "")
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return slug.slice(0, 80).replace(/-$/, "");
}

// Pure: <sanitized-title>-<id>, or bare <id> when the title sanitizes to
// nothing.
export function nodeBasename({ id, title }) {
    const slug = sanitizeTitle(title);
    return slug ? `${slug}-${id}` : `${id}`;
}

// Pure: nodeBasename with an extension.
export function nodeFilename(node, ext) {
    return `${nodeBasename(node)}.${ext}`;
}
