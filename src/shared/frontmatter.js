import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FENCE = "---";

// Split a markdown file into YAML frontmatter (object) and the body string.
// Missing frontmatter yields an empty `data` object.
export function parse(content) {
    if (!content.startsWith(FENCE + "\n") && content !== FENCE) {
        return { data: {}, body: content };
    }
    const rest = content.slice(FENCE.length);
    const end = rest.indexOf("\n" + FENCE);
    if (end === -1) {
        return { data: {}, body: content };
    }
    const yaml = rest.slice(0, end);
    let body = rest.slice(end + 1 + FENCE.length);
    // Drop the single newline that follows the closing fence, if any.
    if (body.startsWith("\n")) {
        body = body.slice(1);
    }
    const data = parseYaml(yaml) ?? {};
    return { data, body };
}

// Serialize `data` as YAML frontmatter prepended to `body`.
// Keys with null/undefined values are dropped so optional fields stay absent.
export function stringify(data, body) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value != null));
    const yaml = stringifyYaml(clean);
    return `${FENCE}\n${yaml}${FENCE}\n${body}`;
}
