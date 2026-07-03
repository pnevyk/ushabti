import MarkdownIt from "markdown-it";

// Partial, two-way conversion between Atlassian Document Format (ADF) and
// markdown. Covered: paragraphs, headings, bold/italic/code/strikethrough/
// links, bullet+ordered lists (nested), code blocks, blockquotes, horizontal
// rules, hard breaks. Anything else degrades to its plain text.
//
// Smart cards (inline/block/embed links to Jira tickets or Confluence pages)
// round-trip losslessly as markdown links carrying a sentinel title that
// encodes the card type: "card" (inlineCard), "card-block" (blockCard),
// "card-embed" (embedCard). Plain links have no title, so they stay links.

// ---------------------------------------------------------------------------
// ADF -> markdown
// ---------------------------------------------------------------------------

export function adfToMarkdown(adf) {
    if (adf == null || !Array.isArray(adf.content)) {
        return "";
    }
    return renderBlocks(adf.content);
}

function renderBlocks(nodes) {
    return nodes
        .map(renderBlock)
        .filter((block) => block !== "")
        .join("\n\n");
}

function renderBlock(node) {
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
            return prefixLines(renderBlocks(node.content ?? []), "> ");
        case "bulletList":
            return renderList(node, "bullet");
        case "orderedList":
            return renderList(node, "ordered");
        case "table":
            return renderTable(node);
        case "blockCard":
            return cardLink(node, "card-block");
        case "embedCard":
            return cardLink(node, "card-embed");
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

function renderList(node, kind) {
    return (node.content ?? [])
        .map((item, i) => {
            const marker = kind === "ordered" ? `${i + 1}. ` : "- ";
            // Join an item's blocks tightly so a paragraph and its sub-list
            // stay on adjacent lines rather than separated by a blank line.
            const inner = (item.content ?? []).map(renderBlock).join("\n");
            return marker + indentContinuation(inner, marker.length);
        })
        .join("\n");
}

// Render an ADF table as a GFM pipe table. The first row is treated as the
// header (GFM requires one). Cell block content is flattened to a single line
// since GFM cells cannot hold block structure.
function renderTable(node) {
    const rows = node.content ?? [];
    if (!rows.length) {
        return "";
    }
    const renderRow = (row) => `| ${(row.content ?? []).map(renderCell).join(" | ")} |`;
    const columns = (rows[0].content ?? []).length;
    const separator = `| ${Array(columns).fill("---").join(" | ")} |`;
    const body = rows.slice(1).map(renderRow);
    return [renderRow(rows[0]), separator, ...body].join("\n");
}

function renderCell(cell) {
    return renderBlocks(cell.content ?? [])
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

// Link title sentinel -> smart card node type. See the header comment.
const CARD_TITLES = { card: "inlineCard", "card-block": "blockCard", "card-embed": "embedCard" };

export function markdownToAdf(source) {
    const tokens = md.parse(source ?? "", {});
    const doc = { type: "doc", content: [] };
    const stack = [doc];
    const top = () => stack[stack.length - 1];

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
                const node = { type: "codeBlock" };
                const lang = token.info?.trim().split(/\s+/)[0];
                if (lang) node.attrs = { language: lang };
                const code = token.content.replace(/\n$/, "");
                if (code) node.content = [{ type: "text", text: code }];
                top().content.push(node);
                break;
            }
            case "hr":
                top().content.push({ type: "rule" });
                break;
            case "inline":
                top().content.push(...renderInlineTokens(token.children));
                break;
            default:
                break;
        }
    }

    hoistBlockCards(doc.content);
    return { version: 1, type: "doc", content: doc.content };
}

// Block/embed cards arrive wrapped in a paragraph (markdown-it parses their
// link inline). ADF places them at block level, so lift a paragraph whose sole
// child is a block/embed card up to where the paragraph sat. Inline cards are
// genuinely inline and stay inside their paragraph.
function hoistBlockCards(nodes) {
    for (const node of nodes) {
        if (Array.isArray(node.content)) {
            hoistBlockCards(node.content);
        }
    }
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (
            node.type === "paragraph" &&
            node.content?.length === 1 &&
            (node.content[0].type === "blockCard" || node.content[0].type === "embedCard")
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
    // When set, we're inside a smart-card link: emit the card node on close and
    // swallow its display text.
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
                if (card) break;
                if (token.content) text(token.content);
                break;
            case "code_inline":
                text(token.content, { type: "code" });
                break;
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
                if (type) {
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
                    out.push({ type: card.type, attrs: { url: card.url } });
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

function popMark(marks, type) {
    for (let i = marks.length - 1; i >= 0; i--) {
        if (marks[i].type === type) {
            marks.splice(i, 1);
            return;
        }
    }
}
