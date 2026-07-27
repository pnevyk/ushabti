import MarkdownIt from "markdown-it";
import { CliError } from "./errors.js";

// Partial, two-way conversion between Atlassian Document Format (ADF) and
// markdown. Covered: paragraphs, headings, bold/italic/code/strikethrough/
// links, bullet+ordered lists (nested), code blocks, blockquotes, horizontal
// rules, hard breaks. Anything else degrades to its plain text.
//
// Smart cards (inline/block/embed links to Jira tickets or Confluence pages)
// round-trip losslessly as markdown links carrying a sentinel title that
// encodes the card type: "card" (inlineCard), "card-block" (blockCard),
// "card-embed" (embedCard). Plain links have no title, so they stay links.
//
// Panels (callout boxes) round-trip through GitHub-flavored markdown alert
// syntax, a blockquote whose first line is a "[!TYPE]" marker: NOTE, TIP,
// IMPORTANT, WARNING, CAUTION map to the ADF panelTypes note, tip, info,
// warning, error respectively. ADF panelTypes with no GFM equivalent
// ("success", "custom", ...) degrade to a plain blockquote (marker dropped);
// markdown has no way to author those.
//
// Confluence-specific nodes (real pages use these far more than Jira
// descriptions do) round-trip as follows:
// - Multi-column layouts: `<!-- layout -->` / `<!-- layout-column -->` /
//   `<!-- /layout -->` sentinel lines wrap each column's blocks. Column width
//   ratios aren't representable in markdown and come back evenly split.
// - Macros without an editable body (`extension`/`inlineExtension`, e.g. a
//   table of contents): a fenced code block tagged `confluence-macro` (block)
//   or an inline code span `` `[confluence-macro:{...}]` `` (inline), holding
//   the macro's JSON descriptor verbatim. Opaque passthrough, not meant to be
//   hand-authored.
// - Macros with an editable body (`bodiedExtension`, e.g. "expand"): the same
//   `<!-- confluence-macro {...} --> ... <!-- /confluence-macro -->` sentinel
//   pair as layouts, wrapping ordinary nested markdown.
// - Media (`mediaSingle`/`media`): `![alt](attachment:<mediaId>)`, a custom
//   `attachment:` URL scheme carrying the existing Confluence media id. Only
//   round-trips a reference to media that already exists; there is no upload
//   path to attach new local images.
// - Mentions: reuse the smart-card link mechanism, `[Display Name](accountId
//   "mention")`.
// - Status lozenges: `` `[status:Label|color]` ``. Dates: `` `[date:YYYY-MM-DD]` ``.
// - Task lists / decision lists: native GFM checkboxes (`- [ ]`/`- [x]`) for
//   tasks; a `- [decision] ...` marker (no native GFM equivalent) for
//   decisions. Detected after parsing a plain bullet list, same trick as
//   panel detection: if every item carries the marker, the list is retyped.
// - Expandable sections (`expand`/`nestedExpand`, the "Expand" macro): GitHub's
//   collapsible-section HTML, `<details>` / `<summary>title</summary>` /
//   `</details>` sentinel lines wrapping ordinary nested markdown -- renders
//   as a real collapsible section on GitHub, not just inert text. Both node
//   types round-trip as plain `expand`; `nestedExpand` (required inside table
//   cells) is indistinguishable once GFM's cell-flattening already discards
//   block structure there, same limitation as any other block content in a
//   cell.

// ---------------------------------------------------------------------------
// ADF -> markdown
// ---------------------------------------------------------------------------

export function adfToMarkdown(adf, { plugins = [] } = {}) {
    if (adf == null || !Array.isArray(adf.content)) {
        return "";
    }
    return renderBlocks(adf.content, { plugins });
}

function renderBlocks(nodes, options) {
    return nodes
        .map((node) => renderBlock(node, options))
        .filter((block) => block !== "")
        .join("\n\n");
}

function renderBlock(node, options) {
    switch (node.type) {
        case "paragraph":
            return renderInline(node.content);
        case "heading":
            return `${"#".repeat(node.attrs?.level ?? 1)} ${renderInline(node.content)}`;
        case "codeBlock": {
            const lang = node.attrs?.language ?? "";
            const code = (node.content ?? []).map((n) => n.text ?? "").join("");
            return `\`\`\`${lang}\n${code}\n\`\`\``;
        }
        case "rule":
            return "---";
        case "blockquote":
            return prefixLines(renderBlocks(node.content ?? [], options), "> ");
        case "panel": {
            const alertType = PANEL_TO_ALERT[node.attrs?.panelType];
            const body = renderBlocks(node.content ?? [], options);
            const text = alertType ? [`[!${alertType}]`, body].filter(Boolean).join("\n") : body;
            return prefixLines(text, "> ");
        }
        case "bulletList":
            return renderList(node, "bullet", options);
        case "orderedList":
            return renderList(node, "ordered", options);
        case "taskList":
            return renderList(node, "task", options);
        case "decisionList":
            return renderList(node, "decision", options);
        case "table":
            return renderTable(node, options);
        case "blockCard":
            return cardLink(node, "card-block");
        case "embedCard":
            return cardLink(node, "card-embed");
        case "layoutSection":
            return renderLayoutSection(node, options);
        case "extension":
        case "inlineExtension": {
            const plugin = options?.plugins?.find((p) => p.detect(node));
            return plugin ? pluginFence(plugin, node) : macroFence(node);
        }
        case "bodiedExtension":
            return macroBlock(node, options);
        case "mediaSingle":
            return mediaLink(node);
        case "expand":
        case "nestedExpand":
            return renderExpand(node, options);
        default:
            return renderInline(node.content ?? []);
    }
}

// A smart card carries only a URL (in attrs.url, or nested under attrs.data).
function cardUrl(node) {
    return node.attrs?.url ?? node.attrs?.data?.url ?? null;
}

// Render a card as a markdown link whose title sentinel encodes the card type
// so markdownToAdf can reconstruct it. No URL means we can't represent it, so
// it degrades to an empty string (dropped by renderBlocks).
function cardLink(node, kind) {
    const url = cardUrl(node);
    return url ? `[${url}](${url} "${kind}")` : "";
}

// A layoutSection's columns have no markdown equivalent, so each column's
// blocks are wrapped in HTML-comment sentinels. Column width ratios (attrs on
// layoutColumn) aren't representable and are lost -- markdownToAdf splits
// width evenly across however many columns come back.
function renderLayoutSection(node, options) {
    const columns = (node.content ?? []).map((col) => renderBlocks(col.content ?? [], options));
    return ["<!-- layout -->", columns.join("\n\n<!-- layout-column -->\n\n"), "<!-- /layout -->"].join("\n\n");
}

// extension/inlineExtension carry no editable body, just a macro descriptor
// (extensionKey, extensionType, parameters, ...). Passed through verbatim as
// JSON in a fenced code block (block extensions) or inline code span (inline
// extensions) -- not meant to be hand-edited, just preserved on round-trip.
function macroFence(node) {
    const json = JSON.stringify(node.attrs ?? {});
    return node.type === "inlineExtension" ? `\`[confluence-macro:${json}]\`` : `\`\`\`confluence-macro\n${json}\n\`\`\``;
}

// A macro claimed by a plugin renders as a real fenced block in the plugin's
// target language, with its raw ADF attrs stashed in a details comment above
// so encoding can round-trip them (and know which plugin produced it -- see
// the header comment and the plugin module docs for the full round-trip).
function pluginFence(plugin, node) {
    const { source, details } = plugin.decode(node);
    const comment = `<!-- confluence-plugin ${stringifyForComment({ plugin: plugin.id, ...details })} -->`;
    return `${comment}\n\`\`\`${plugin.target}\n${source}\n\`\`\``;
}

// A details comment is plain paragraph text, not a code span, so CommonMark's
// backslash-escape rule (\" -> ", \\ -> \) would otherwise corrupt any nested
// JSON string that itself needed escaping (e.g. the mermaid plugin's
// JSON-wrapped diagram source). Doubling every backslash pre-compensates:
// markdown-it undoes exactly one layer of backslash-escaping when it parses
// this back into plain text, recovering the original JSON untouched.
function stringifyForComment(value) {
    return JSON.stringify(value).replace(/\\/g, "\\\\");
}

// bodiedExtension has an editable body, so the body renders as ordinary
// nested markdown between two sentinel comments; only the macro descriptor
// itself is opaque.
function macroBlock(node, options) {
    const json = JSON.stringify(node.attrs ?? {});
    const body = renderBlocks(node.content ?? [], options);
    return [`<!-- confluence-macro ${json} -->`, body, "<!-- /confluence-macro -->"].join("\n\n");
}

// mediaSingle wraps a single media node; only an existing Confluence media id
// can be represented (attachment: URL scheme), there is no way to attach a
// brand-new local file through markdown.
function mediaLink(node) {
    const media = (node.content ?? []).find((n) => n.type === "media");
    const id = media?.attrs?.id;
    if (!id) {
        return "";
    }
    const alt = media.attrs?.alt ?? "";
    return `![${alt}](attachment:${id})`;
}

// expand/nestedExpand render identically as a GitHub collapsible section;
// nestedExpand's table-cell-only placement isn't distinguishable on the way
// back in (see the header comment).
function renderExpand(node, options) {
    const title = node.attrs?.title ?? "";
    const body = renderBlocks(node.content ?? [], options);
    return ["<details>", `<summary>${title}</summary>`, body, "</details>"].join("\n\n");
}

function renderList(node, kind, options) {
    // taskItem/decisionItem hold inline content directly (no paragraph
    // wrapper), unlike listItem which holds blocks.
    const isFlat = kind === "task" || kind === "decision";
    return (node.content ?? [])
        .map((item, i) => {
            const marker = listMarker(kind, item, i);
            const inner = isFlat
                ? renderInline(item.content)
                : // Join an item's blocks tightly so a paragraph and its sub-list
                  // stay on adjacent lines rather than separated by a blank line.
                  (item.content ?? []).map((n) => renderBlock(n, options)).join("\n");
            return marker + indentContinuation(inner, marker.length);
        })
        .join("\n");
}

function listMarker(kind, item) {
    switch (kind) {
        case "task":
            return item.attrs?.state === "DONE" ? "- [x] " : "- [ ] ";
        case "decision":
            return "- [decision] ";
        default:
            return "- ";
    }
}

// Render an ADF table as a GFM pipe table. The first row is treated as the
// header (GFM requires one). Cell block content is flattened to a single line
// since GFM cells cannot hold block structure.
function renderTable(node, options) {
    const rows = node.content ?? [];
    if (!rows.length) {
        return "";
    }
    const renderRow = (row) => `| ${(row.content ?? []).map((cell) => renderCell(cell, options)).join(" | ")} |`;
    const columns = (rows[0].content ?? []).length;
    const separator = `| ${Array(columns).fill("---").join(" | ")} |`;
    const body = rows.slice(1).map(renderRow);
    return [renderRow(rows[0]), separator, ...body].join("\n");
}

function renderCell(cell, options) {
    return renderBlocks(cell.content ?? [], options)
        .replace(/\s*\n+\s*/g, " ")
        .replace(/\|/g, "\\|")
        .trim();
}

function renderInline(nodes) {
    return (nodes ?? []).map(renderText).join("");
}

function renderText(node) {
    if (node.type === "hardBreak") {
        return "\\\n";
    }
    if (node.type === "inlineCard") {
        return cardLink(node, "card");
    }
    if (node.type === "mention") {
        const text = node.attrs?.text || node.attrs?.id || "";
        return `[${text}](${node.attrs?.id ?? ""} "mention")`;
    }
    if (node.type === "status") {
        return `\`[status:${node.attrs?.text ?? ""}|${node.attrs?.color ?? "neutral"}]\``;
    }
    if (node.type === "date") {
        return `\`[date:${dateAttrToIso(node.attrs?.timestamp)}]\``;
    }
    if (node.type === "inlineExtension") {
        return macroFence(node);
    }
    if (node.type !== "text") {
        return renderInline(node.content);
    }
    let text = node.text ?? "";
    const marks = node.marks ?? [];
    if (hasMark(marks, "code")) text = `\`${text}\``;
    if (hasMark(marks, "strike")) text = `~~${text}~~`;
    if (hasMark(marks, "em")) text = `*${text}*`;
    if (hasMark(marks, "strong")) text = `**${text}**`;
    const link = marks.find((mark) => mark.type === "link");
    if (link) text = `[${text}](${link.attrs?.href ?? ""})`;
    return text;
}

function dateAttrToIso(timestamp) {
    const ms = Number(timestamp);
    return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
}

function isoToDateAttr(iso) {
    return String(Date.parse(iso));
}

function hasMark(marks, type) {
    return marks.some((mark) => mark.type === type);
}

function prefixLines(text, prefix) {
    return text
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
}

// Indent every line after the first by `width` spaces (for list continuations).
function indentContinuation(text, width) {
    const pad = " ".repeat(width);
    return text
        .split("\n")
        .map((line, i) => (i === 0 ? line : pad + line))
        .join("\n");
}

// ---------------------------------------------------------------------------
// markdown -> ADF
// ---------------------------------------------------------------------------

const md = new MarkdownIt();

// Link title sentinel -> smart card / mention node type. See the header comment.
const CARD_TITLES = { card: "inlineCard", "card-block": "blockCard", "card-embed": "embedCard", mention: "mention" };

// GFM alert kind -> ADF panelType, and its inverse. See the header comment.
const ALERT_TO_PANEL = { NOTE: "note", TIP: "tip", IMPORTANT: "info", WARNING: "warning", CAUTION: "error" };
const PANEL_TO_ALERT = Object.fromEntries(Object.entries(ALERT_TO_PANEL).map(([k, v]) => [v, k]));

// Checkbox / decision markers at the start of a list item's first text node,
// used to retype a plain bulletList into a taskList/decisionList after parsing.
const CHECKBOX_MARKER = /^\[([ xX])\]\s?/;
const DECISION_MARKER = /^\[decision\]\s?/;

export function markdownToAdf(source, { plugins = [], defaults = {} } = {}) {
    const tokens = md.parse(source ?? "", {});
    const doc = { type: "doc", content: [] };
    const stack = [doc];
    const top = () => stack[stack.length - 1];
    // Set by a `<!-- confluence-plugin {...} -->` sentinel immediately above a
    // fence; consumed (and cleared) by the very next fence/code_block token.
    const pluginState = { pending: null };

    for (const token of tokens) {
        switch (token.type) {
            case "paragraph_open":
                push(stack, { type: "paragraph", content: [] });
                break;
            case "heading_open":
                push(stack, { type: "heading", attrs: { level: Number(token.tag.slice(1)) }, content: [] });
                break;
            case "bullet_list_open":
                push(stack, { type: "bulletList", content: [] });
                break;
            case "ordered_list_open":
                push(stack, { type: "orderedList", content: [] });
                break;
            case "list_item_open":
                push(stack, { type: "listItem", content: [] });
                break;
            case "blockquote_open":
                push(stack, { type: "blockquote", content: [] });
                break;
            case "table_open":
                push(stack, { type: "table", content: [] });
                break;
            case "tr_open":
                push(stack, { type: "tableRow", content: [] });
                break;
            case "th_open":
                // Cells hold block content, but markdown-it emits inline tokens
                // directly, so wrap each cell in a paragraph.
                push(stack, { type: "tableHeader", attrs: {}, content: [] });
                push(stack, { type: "paragraph", content: [] });
                break;
            case "td_open":
                push(stack, { type: "tableCell", attrs: {}, content: [] });
                push(stack, { type: "paragraph", content: [] });
                break;
            case "th_close":
            case "td_close":
                stack.pop(); // paragraph
                stack.pop(); // cell
                break;
            case "thead_open":
            case "thead_close":
            case "tbody_open":
            case "tbody_close":
                break; // no ADF equivalent; rows attach directly to the table
            case "paragraph_close":
            case "heading_close":
            case "bullet_list_close":
            case "ordered_list_close":
            case "list_item_close":
            case "blockquote_close":
            case "table_close":
            case "tr_close":
                stack.pop();
                break;
            case "fence":
            case "code_block": {
                const info = token.info?.trim() ?? "";
                const targetPlugin = plugins.find((p) => p.target === info);
                if (targetPlugin) {
                    const pending = pluginState.pending;
                    pluginState.pending = null;
                    const id = pending?.plugin ?? defaults[info];
                    if (!id) {
                        throw new CliError(`No default confluence.plugins entry for target "${info}"`);
                    }
                    const plugin = plugins.find((p) => p.id === id);
                    const { plugin: _pluginId, ...details } = pending ?? {};
                    const attrs = plugin.encode(token.content.replace(/\n$/, ""), pending ? details : null);
                    top().content.push({ type: "extension", attrs });
                    break;
                }
                if (info === "confluence-macro") {
                    top().content.push({ type: "extension", attrs: parseJson(token.content.replace(/\n$/, "")) });
                    break;
                }
                const node = { type: "codeBlock" };
                const lang = info.split(/\s+/)[0];
                if (lang) node.attrs = { language: lang };
                const code = token.content.replace(/\n$/, "");
                if (code) node.content = [{ type: "text", text: code }];
                top().content.push(node);
                break;
            }
            case "hr":
                top().content.push({ type: "rule" });
                break;
            case "inline": {
                const nodes = renderInlineTokens(token.children);
                const parent = stack[stack.length - 2];

                const isPanelCandidate =
                    top().type === "paragraph" &&
                    parent?.type === "blockquote" &&
                    parent.content.length === 1 &&
                    parent.content[0] === top();
                const panelMarker =
                    isPanelCandidate && nodes[0]?.type === "text" && !nodes[0].marks
                        ? nodes[0].text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i)
                        : null;
                if (panelMarker) {
                    parent.type = "panel";
                    parent.attrs = { panelType: ALERT_TO_PANEL[panelMarker[1].toUpperCase()] };
                    const rest = nodes.slice(1);
                    if (rest[0]?.type === "text" && !rest[0].marks && rest[0].text === " ") rest.shift();
                    if (rest.length === 0) {
                        parent.content.pop(); // drop the now-empty marker-only paragraph
                    } else {
                        top().content.push(...rest);
                    }
                    break;
                }

                const soleText = nodes.length === 1 && nodes[0].type === "text" && !nodes[0].marks ? nodes[0].text : null;
                if (soleText != null && handleSentinelParagraph(soleText, stack, pluginState)) {
                    break;
                }

                top().content.push(...nodes);
                break;
            }
            default:
                break;
        }
    }

    retypeMarkedLists(doc.content);
    hoistBlockLevelNodes(doc.content);
    return { version: 1, type: "doc", content: doc.content };
}

// Recognize a standalone HTML-comment sentinel paragraph (layout / macro
// wrapper markers -- see the header comment) and perform the corresponding
// stack surgery instead of emitting it as a normal paragraph. Returns true
// when the paragraph was consumed as a sentinel.
function handleSentinelParagraph(text, stack, pluginState) {
    if (text === "<details>") {
        discardParagraph(stack);
        push(stack, { type: "expand", attrs: { title: "" }, content: [] });
        stack.push({ type: "sentinel" });
        return true;
    }
    const summaryMatch = text.match(/^<summary>(.*)<\/summary>$/);
    if (summaryMatch && stack[stack.length - 2]?.type === "expand") {
        const expand = stack[stack.length - 2];
        discardParagraph(stack);
        expand.attrs.title = summaryMatch[1];
        stack.push({ type: "sentinel" });
        return true;
    }
    if (text === "</details>") {
        discardParagraph(stack);
        stack.pop(); // close expand
        stack.push({ type: "sentinel" });
        return true;
    }
    if (text === "<!-- layout -->") {
        discardParagraph(stack);
        push(stack, { type: "layoutSection", content: [] });
        push(stack, { type: "layoutColumn", attrs: { width: 100 }, content: [] });
        stack.push({ type: "sentinel" });
        return true;
    }
    if (text === "<!-- layout-column -->") {
        discardParagraph(stack);
        stack.pop(); // close the previous layoutColumn
        push(stack, { type: "layoutColumn", attrs: { width: 100 }, content: [] });
        stack.push({ type: "sentinel" });
        return true;
    }
    if (text === "<!-- /layout -->") {
        discardParagraph(stack);
        stack.pop(); // close the last layoutColumn
        const section = stack.pop(); // close layoutSection
        const width = 100 / section.content.length;
        for (const column of section.content) {
            column.attrs.width = width;
        }
        stack.push({ type: "sentinel" });
        return true;
    }
    const pluginOpen = text.match(/^<!-- confluence-plugin (.+) -->$/);
    if (pluginOpen) {
        discardParagraph(stack);
        pluginState.pending = parseJson(pluginOpen[1]);
        stack.push({ type: "sentinel" });
        return true;
    }
    const macroOpen = text.match(/^<!-- confluence-macro (.+) -->$/);
    if (macroOpen) {
        discardParagraph(stack);
        push(stack, { type: "bodiedExtension", attrs: parseJson(macroOpen[1]), content: [] });
        stack.push({ type: "sentinel" });
        return true;
    }
    if (text === "<!-- /confluence-macro -->") {
        discardParagraph(stack);
        stack.pop(); // close bodiedExtension
        stack.push({ type: "sentinel" });
        return true;
    }
    return false;
}

// Remove the paragraph that's currently open on the stack (opened by the
// preceding paragraph_open) so a sentinel line never appears in the tree as
// literal text. Leaves a stack frame for the upcoming paragraph_close to pop.
function discardParagraph(stack) {
    stack[stack.length - 2].content.pop();
    stack.pop();
}

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

// Retype a plain bulletList into a taskList or decisionList when every item
// starts with a checkbox ("[ ] "/"[x] ") or "[decision] " marker, stripping
// the marker text. Same "detect a text pattern, mutate node.type" idiom as
// panel detection above.
function retypeMarkedLists(nodes) {
    for (const node of nodes) {
        if (Array.isArray(node.content)) {
            retypeMarkedLists(node.content);
        }
    }
    for (const node of nodes) {
        if (node.type !== "bulletList") {
            continue;
        }
        const items = node.content ?? [];
        if (items.length && items.every((item) => CHECKBOX_MARKER.test(firstItemText(item) ?? ""))) {
            node.type = "taskList";
            node.attrs = { localId: "" };
            items.forEach((item, i) => {
                const state = /^x$/i.test(CHECKBOX_MARKER.exec(firstItemText(item))[1]) ? "DONE" : "TODO";
                stripFirstItemText(item, CHECKBOX_MARKER);
                item.type = "taskItem";
                item.attrs = { localId: String(i), state };
            });
        } else if (items.length && items.every((item) => DECISION_MARKER.test(firstItemText(item) ?? ""))) {
            node.type = "decisionList";
            node.attrs = { localId: "" };
            items.forEach((item, i) => {
                stripFirstItemText(item, DECISION_MARKER);
                item.type = "decisionItem";
                item.attrs = { localId: String(i) };
            });
        }
    }
}

// Only a "simple" item -- exactly one paragraph, no sub-lists or extra blocks
// -- can be represented as a taskItem/decisionItem, whose ADF content is
// inline* directly (unlike listItem, which holds blocks). Anything more
// complex is left as an ordinary bulletList item (the marker text stays
// literal) rather than silently dropping the extra blocks.
function firstItemText(item) {
    const blocks = item.content ?? [];
    if (blocks.length !== 1 || blocks[0].type !== "paragraph") {
        return null;
    }
    const firstInline = blocks[0].content?.[0];
    return firstInline?.type === "text" && !firstInline.marks ? firstInline.text : null;
}

// Strip the marker from the item's sole paragraph, then flatten the item's
// content to that paragraph's inline nodes (taskItem/decisionItem shape).
function stripFirstItemText(item, marker) {
    const paragraph = item.content[0];
    const firstInline = paragraph.content[0];
    firstInline.text = firstInline.text.replace(marker, "");
    item.content = firstInline.text === "" ? paragraph.content.slice(1) : paragraph.content;
}

// Block/embed cards and media arrive wrapped in a paragraph (markdown-it
// parses their link/image inline). ADF places them at block level, so lift a
// paragraph whose sole child is one of these up to where the paragraph sat.
// Inline cards are genuinely inline and stay inside their paragraph.
function hoistBlockLevelNodes(nodes) {
    for (const node of nodes) {
        if (Array.isArray(node.content)) {
            hoistBlockLevelNodes(node.content);
        }
    }
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (
            node.type === "paragraph" &&
            node.content?.length === 1 &&
            ["blockCard", "embedCard", "mediaSingle"].includes(node.content[0].type)
        ) {
            nodes[i] = node.content[0];
        }
    }
}

function push(stack, node) {
    stack[stack.length - 1].content.push(node);
    stack.push(node);
}

function renderInlineTokens(children) {
    const marks = [];
    const out = [];
    // When set, we're inside a smart-card or mention link: emit the node on
    // close. Cards swallow their display text (it's always == the URL);
    // mentions accumulate it as the display name.
    let card = null;
    const text = (content, extra) => {
        const all = extra ? [...marks, extra] : marks;
        const node = { type: "text", text: content };
        if (all.length) node.marks = all.map((mark) => ({ ...mark }));
        out.push(node);
    };

    for (const token of children ?? []) {
        switch (token.type) {
            case "text":
                if (card) {
                    if (card.type === "mention") card.text += token.content;
                    break;
                }
                if (token.content) text(token.content);
                break;
            case "code_inline": {
                const sentinel = matchInlineSentinel(token.content);
                if (sentinel) {
                    out.push(sentinel);
                } else {
                    text(token.content, { type: "code" });
                }
                break;
            }
            case "image": {
                const src = token.attrGet("src") ?? "";
                if (src.startsWith("attachment:")) {
                    out.push({
                        type: "mediaSingle",
                        attrs: { layout: "center" },
                        content: [{ type: "media", attrs: { id: src.slice("attachment:".length), type: "file", alt: token.content ?? "" } }],
                    });
                }
                break;
            }
            case "strong_open":
                marks.push({ type: "strong" });
                break;
            case "em_open":
                marks.push({ type: "em" });
                break;
            case "s_open":
                marks.push({ type: "strike" });
                break;
            case "link_open": {
                const type = CARD_TITLES[token.attrGet("title")];
                if (type === "mention") {
                    card = { type, id: token.attrGet("href") ?? "", text: "" };
                } else if (type) {
                    card = { type, url: token.attrGet("href") ?? "" };
                } else {
                    marks.push({ type: "link", attrs: { href: token.attrGet("href") ?? "" } });
                }
                break;
            }
            case "strong_close":
                popMark(marks, "strong");
                break;
            case "em_close":
                popMark(marks, "em");
                break;
            case "s_close":
                popMark(marks, "strike");
                break;
            case "link_close":
                if (card) {
                    out.push(
                        card.type === "mention"
                            ? { type: "mention", attrs: { id: card.id, text: card.text } }
                            : { type: card.type, attrs: { url: card.url } },
                    );
                    card = null;
                } else {
                    popMark(marks, "link");
                }
                break;
            case "hardbreak":
                out.push({ type: "hardBreak" });
                break;
            case "softbreak":
                text(" ");
                break;
            default:
                break;
        }
    }
    return out;
}

// Recognize the inline sentinel forms (status lozenge, date, macro without a
// body) carried in a code span's raw text. Returns the ADF node, or null if
// the code span is just ordinary inline code.
function matchInlineSentinel(content) {
    const status = content.match(/^\[status:([^|]+)\|(\w+)\]$/);
    if (status) {
        return { type: "status", attrs: { text: status[1], color: status[2] } };
    }
    const date = content.match(/^\[date:(\d{4}-\d{2}-\d{2})\]$/);
    if (date) {
        return { type: "date", attrs: { timestamp: isoToDateAttr(date[1]) } };
    }
    const macro = content.match(/^\[confluence-macro:(.+)\]$/);
    if (macro) {
        return { type: "inlineExtension", attrs: parseJson(macro[1]) };
    }
    return null;
}

function popMark(marks, type) {
    for (let i = marks.length - 1; i >= 0; i--) {
        if (marks[i].type === type) {
            marks.splice(i, 1);
            return;
        }
    }
}
