import { test } from "node:test";
import assert from "node:assert/strict";
import { adfToMarkdown, markdownToAdf } from "../src/shared/adf.js";
import { mermaidPlugin } from "../src/plugins/mermaid.js";
import { umlPlugin } from "../src/plugins/uml.js";
import { InvalidConfigError } from "../src/shared/errors.js";

const doc = (...content) => ({ version: 1, type: "doc", content });
const text = (t, marks) => (marks ? { type: "text", text: t, marks } : { type: "text", text: t });

test("adfToMarkdown: paragraphs and headings", () => {
    const adf = doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
        { type: "paragraph", content: [text("Hello world")] },
    );
    assert.equal(adfToMarkdown(adf), "## Title\n\nHello world");
});

test("adfToMarkdown: inline marks", () => {
    const adf = doc({
        type: "paragraph",
        content: [
            text("a "),
            text("bold", [{ type: "strong" }]),
            text(" "),
            text("em", [{ type: "em" }]),
            text(" "),
            text("code", [{ type: "code" }]),
            text(" "),
            text("link", [{ type: "link", attrs: { href: "https://x" } }]),
        ],
    });
    assert.equal(adfToMarkdown(adf), "a **bold** *em* `code` [link](https://x)");
});

test("adfToMarkdown: nested bullet list", () => {
    const adf = doc({
        type: "bulletList",
        content: [
            {
                type: "listItem",
                content: [
                    { type: "paragraph", content: [text("one")] },
                    {
                        type: "bulletList",
                        content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("nested")] }] }],
                    },
                ],
            },
            { type: "listItem", content: [{ type: "paragraph", content: [text("two")] }] },
        ],
    });
    assert.equal(adfToMarkdown(adf), "- one\n  - nested\n- two");
});

test("adfToMarkdown: code block keeps language", () => {
    const adf = doc({ type: "codeBlock", attrs: { language: "js" }, content: [text("const x = 1;")] });
    assert.equal(adfToMarkdown(adf), "```js\nconst x = 1;\n```");
});

test("adfToMarkdown: null description yields empty string", () => {
    assert.equal(adfToMarkdown(null), "");
    assert.equal(adfToMarkdown(undefined), "");
});

test("markdownToAdf: heading and paragraph", () => {
    const adf = markdownToAdf("## Title\n\nHello world");
    assert.deepEqual(adf, doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
        { type: "paragraph", content: [text("Hello world")] },
    ));
});

test("markdownToAdf: inline marks", () => {
    const adf = markdownToAdf("**bold** and `code` and [link](https://x)");
    const para = adf.content[0];
    assert.equal(para.type, "paragraph");
    assert.deepEqual(para.content[0], text("bold", [{ type: "strong" }]));
    assert.deepEqual(para.content.at(-1), text("link", [{ type: "link", attrs: { href: "https://x" } }]));
});

test("markdownToAdf: fenced code block keeps language", () => {
    const adf = markdownToAdf("```js\nconst x = 1;\n```");
    assert.deepEqual(adf.content[0], {
        type: "codeBlock",
        attrs: { language: "js" },
        content: [text("const x = 1;")],
    });
});

test("round-trip: markdown -> adf -> markdown preserves common structures", () => {
    const src = "# Heading\n\nA **bold** and *italic* line.\n\n- one\n- two\n\n```js\nf();\n```";
    assert.equal(adfToMarkdown(markdownToAdf(src)), src);
});

test("markdownToAdf: table yields a valid ADF table, not orphan inline nodes", () => {
    const adf = markdownToAdf("| Code | Meaning |\n| --- | --- |\n| a01 | Clear |");
    assert.deepEqual(adf.content.map((n) => n.type), ["table"]);
    const cell = (type, t) => ({ type, attrs: {}, content: [{ type: "paragraph", content: [text(t)] }] });
    assert.deepEqual(adf.content[0], {
        type: "table",
        content: [
            { type: "tableRow", content: [cell("tableHeader", "Code"), cell("tableHeader", "Meaning")] },
            { type: "tableRow", content: [cell("tableCell", "a01"), cell("tableCell", "Clear")] },
        ],
    });
});

test("adfToMarkdown: table renders as a GFM pipe table", () => {
    const cell = (type, t) => ({ type, content: [{ type: "paragraph", content: [text(t)] }] });
    const adf = doc({
        type: "table",
        content: [
            { type: "tableRow", content: [cell("tableHeader", "Code"), cell("tableHeader", "Meaning")] },
            { type: "tableRow", content: [cell("tableCell", "a01"), cell("tableCell", "Clear")] },
        ],
    });
    assert.equal(adfToMarkdown(adf), "| Code | Meaning |\n| --- | --- |\n| a01 | Clear |");
});

test("round-trip: markdown table survives adf conversion", () => {
    const src = "| Code | Meaning |\n| --- | --- |\n| a01 | Clear |";
    assert.equal(adfToMarkdown(markdownToAdf(src)), src);
});

const TICKET = "https://acme.atlassian.net/browse/TEF-153";
const PAGE = "https://acme.atlassian.net/wiki/spaces/ENG/pages/12345";

test("adfToMarkdown: inline card renders inline as a titled link", () => {
    const adf = doc({
        type: "paragraph",
        content: [text("See "), { type: "inlineCard", attrs: { url: TICKET } }, text(" today")],
    });
    assert.equal(adfToMarkdown(adf), `See [${TICKET}](${TICKET} "card") today`);
});

test("adfToMarkdown: block and embed cards render as titled links", () => {
    const adf = doc(
        { type: "blockCard", attrs: { url: TICKET } },
        { type: "embedCard", attrs: { url: PAGE } },
    );
    assert.equal(
        adfToMarkdown(adf),
        `[${TICKET}](${TICKET} "card-block")\n\n[${PAGE}](${PAGE} "card-embed")`,
    );
});

test("adfToMarkdown: card reads url from attrs.data", () => {
    const adf = doc({ type: "paragraph", content: [{ type: "inlineCard", attrs: { data: { url: TICKET } } }] });
    assert.equal(adfToMarkdown(adf), `[${TICKET}](${TICKET} "card")`);
});

test("adfToMarkdown: card without a url renders empty", () => {
    assert.equal(adfToMarkdown(doc({ type: "blockCard", attrs: {} })), "");
    assert.equal(
        adfToMarkdown(doc({ type: "paragraph", content: [{ type: "inlineCard", attrs: {} }] })),
        "",
    );
});

test("markdownToAdf: plain link (no title) stays a link mark, not a card", () => {
    const adf = markdownToAdf(`[TEF-153](${TICKET})`);
    assert.deepEqual(adf.content[0].content[0], text("TEF-153", [{ type: "link", attrs: { href: TICKET } }]));
});

test("markdownToAdf: inline card stays inside its paragraph", () => {
    const adf = markdownToAdf(`See [x](${TICKET} "card") today`);
    assert.deepEqual(adf.content[0].content, [
        text("See "),
        { type: "inlineCard", attrs: { url: TICKET } },
        text(" today"),
    ]);
});

test("markdownToAdf: block/embed cards are hoisted out of the wrapper paragraph", () => {
    const adf = markdownToAdf(`[x](${TICKET} "card-block")\n\n[y](${PAGE} "card-embed")`);
    assert.deepEqual(adf.content, [
        { type: "blockCard", attrs: { url: TICKET } },
        { type: "embedCard", attrs: { url: PAGE } },
    ]);
});

test("round-trip: smart cards survive adf conversion losslessly", () => {
    const adf = doc(
        { type: "paragraph", content: [text("See "), { type: "inlineCard", attrs: { url: TICKET } }] },
        { type: "blockCard", attrs: { url: TICKET } },
        { type: "embedCard", attrs: { url: PAGE } },
    );
    const back = markdownToAdf(adfToMarkdown(adf));
    assert.deepEqual(back.content, adf.content);
});

test("adfToMarkdown: panel renders as a GFM alert blockquote", () => {
    const adf = doc({
        type: "panel",
        attrs: { panelType: "warning" },
        content: [{ type: "paragraph", content: [text("body text")] }],
    });
    assert.equal(adfToMarkdown(adf), "> [!WARNING]\n> body text");
});

test("adfToMarkdown: unmapped panelType falls back to plain blockquote", () => {
    const adf = doc({
        type: "panel",
        attrs: { panelType: "success" },
        content: [{ type: "paragraph", content: [text("body text")] }],
    });
    assert.equal(adfToMarkdown(adf), "> body text");
});

test("markdownToAdf: GFM alert becomes a panel node", () => {
    const adf = markdownToAdf("> [!WARNING]\n> body text");
    assert.deepEqual(adf.content[0], {
        type: "panel",
        attrs: { panelType: "warning" },
        content: [{ type: "paragraph", content: [text("body text")] }],
    });
});

test("markdownToAdf: plain blockquote stays a blockquote", () => {
    const adf = markdownToAdf("> just a quote");
    assert.deepEqual(adf.content[0], {
        type: "blockquote",
        content: [{ type: "paragraph", content: [text("just a quote")] }],
    });
});

test("markdownToAdf: panel with multi-paragraph body", () => {
    const adf = markdownToAdf("> [!NOTE]\n> first\n>\n> second");
    assert.deepEqual(adf.content[0], {
        type: "panel",
        attrs: { panelType: "note" },
        content: [
            { type: "paragraph", content: [text("first")] },
            { type: "paragraph", content: [text("second")] },
        ],
    });
});

test("round-trip: GFM alert survives adf conversion", () => {
    assert.equal(adfToMarkdown(markdownToAdf("> [!WARNING]\n> body text")), "> [!WARNING]\n> body text");
    assert.equal(adfToMarkdown(markdownToAdf("> [!TIP]\n> body text")), "> [!TIP]\n> body text");
});

test("adfToMarkdown: layout section renders columns with HTML-comment sentinels", () => {
    const adf = doc({
        type: "layoutSection",
        content: [
            { type: "layoutColumn", attrs: { width: 50 }, content: [{ type: "paragraph", content: [text("Left")] }] },
            { type: "layoutColumn", attrs: { width: 50 }, content: [{ type: "paragraph", content: [text("Right")] }] },
        ],
    });
    assert.equal(adfToMarkdown(adf), "<!-- layout -->\n\nLeft\n\n<!-- layout-column -->\n\nRight\n\n<!-- /layout -->");
});

test("markdownToAdf: layout sentinels become a layoutSection with even column widths", () => {
    const adf = markdownToAdf("<!-- layout -->\n\nLeft\n\n<!-- layout-column -->\n\nRight\n\n<!-- /layout -->");
    assert.deepEqual(adf.content[0], {
        type: "layoutSection",
        content: [
            { type: "layoutColumn", attrs: { width: 50 }, content: [{ type: "paragraph", content: [text("Left")] }] },
            { type: "layoutColumn", attrs: { width: 50 }, content: [{ type: "paragraph", content: [text("Right")] }] },
        ],
    });
});

test("round-trip: layout section survives adf conversion (width evens out)", () => {
    const md = "<!-- layout -->\n\nLeft\n\n<!-- layout-column -->\n\nMiddle\n\n<!-- layout-column -->\n\nRight\n\n<!-- /layout -->";
    assert.equal(adfToMarkdown(markdownToAdf(md)), md);
});

test("adfToMarkdown: extension/inlineExtension render as opaque macro descriptors", () => {
    const block = doc({ type: "extension", attrs: { extensionKey: "toc", parameters: {} } });
    assert.equal(adfToMarkdown(block), '```confluence-macro\n{"extensionKey":"toc","parameters":{}}\n```');

    const inline = doc({ type: "paragraph", content: [text("See "), { type: "inlineExtension", attrs: { extensionKey: "status-lozenge" } }] });
    assert.equal(adfToMarkdown(inline), 'See `[confluence-macro:{"extensionKey":"status-lozenge"}]`');
});

test("round-trip: extension/inlineExtension macros survive adf conversion", () => {
    const adf = doc(
        { type: "extension", attrs: { extensionKey: "toc", parameters: {} } },
        { type: "paragraph", content: [{ type: "inlineExtension", attrs: { extensionKey: "status-lozenge" } }] },
    );
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: bodiedExtension wraps an editable body in macro sentinels", () => {
    const adf = doc({
        type: "bodiedExtension",
        attrs: { extensionKey: "expand", parameters: { title: "Details" } },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
    assert.equal(
        adfToMarkdown(adf),
        '<!-- confluence-macro {"extensionKey":"expand","parameters":{"title":"Details"}} -->\n\nHidden body\n\n<!-- /confluence-macro -->',
    );
});

test("round-trip: bodiedExtension survives adf conversion with an editable body", () => {
    const adf = doc({
        type: "bodiedExtension",
        attrs: { extensionKey: "expand", parameters: { title: "Details" } },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("round-trip: bodiedExtension attrs with quotes and backslashes survive the sentinel comment", () => {
    const adf = doc({
        type: "bodiedExtension",
        attrs: { extensionKey: "expand", parameters: { title: 'He said "hi"', note: "back\\slash" } },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: media renders as an attachment: image link", () => {
    const adf = doc({
        type: "mediaSingle",
        attrs: { layout: "center" },
        content: [{ type: "media", attrs: { id: "abc-123", type: "file", alt: "Diagram" } }],
    });
    assert.equal(adfToMarkdown(adf), "![Diagram](attachment:abc-123)");
});

test("adfToMarkdown: media without an id renders empty", () => {
    const adf = doc({ type: "mediaSingle", attrs: {}, content: [{ type: "media", attrs: {} }] });
    assert.equal(adfToMarkdown(adf), "");
});

test("markdownToAdf: attachment: image is hoisted to a block-level mediaSingle", () => {
    const adf = markdownToAdf("![Diagram](attachment:abc-123)");
    assert.deepEqual(adf.content[0], {
        type: "mediaSingle",
        attrs: { layout: "center" },
        content: [{ type: "media", attrs: { id: "abc-123", type: "file", alt: "Diagram" } }],
    });
});

test("markdownToAdf: a plain (non-attachment) image is dropped", () => {
    const adf = markdownToAdf("![alt](https://example.com/pic.png)");
    assert.deepEqual(adf.content[0], { type: "paragraph", content: [] });
});

test("round-trip: media survives adf conversion", () => {
    const adf = doc({
        type: "mediaSingle",
        attrs: { layout: "center" },
        content: [{ type: "media", attrs: { id: "abc-123", type: "file", alt: "Diagram" } }],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: mention renders as a sentinel-titled link", () => {
    const adf = doc({ type: "paragraph", content: [text("cc "), { type: "mention", attrs: { id: "acc-1", text: "Jane Doe" } }] });
    assert.equal(adfToMarkdown(adf), 'cc [Jane Doe](acc-1 "mention")');
});

test("markdownToAdf: sentinel-titled link becomes a mention", () => {
    const adf = markdownToAdf('cc [Jane Doe](acc-1 "mention")');
    assert.deepEqual(adf.content[0].content, [text("cc "), { type: "mention", attrs: { id: "acc-1", text: "Jane Doe" } }]);
});

test("round-trip: mention survives adf conversion", () => {
    const adf = doc({ type: "paragraph", content: [{ type: "mention", attrs: { id: "acc-1", text: "Jane Doe" } }] });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: status renders as a code-span sentinel", () => {
    const adf = doc({ type: "paragraph", content: [{ type: "status", attrs: { text: "In Progress", color: "blue" } }] });
    assert.equal(adfToMarkdown(adf), "`[status:In Progress|blue]`");
});

test("adfToMarkdown: date renders as a code-span sentinel", () => {
    const adf = doc({ type: "paragraph", content: [{ type: "date", attrs: { timestamp: String(Date.parse("2026-07-27")) } }] });
    assert.equal(adfToMarkdown(adf), "`[date:2026-07-27]`");
});

test("markdownToAdf: status/date sentinels become their ADF nodes, plain code stays code", () => {
    const adf = markdownToAdf("`[status:In Progress|blue]` `[date:2026-07-27]` `plain`");
    assert.deepEqual(adf.content[0].content, [
        { type: "status", attrs: { text: "In Progress", color: "blue" } },
        text(" "),
        { type: "date", attrs: { timestamp: String(Date.parse("2026-07-27")) } },
        text(" "),
        text("plain", [{ type: "code" }]),
    ]);
});

test("round-trip: status and date survive adf conversion", () => {
    const adf = doc({
        type: "paragraph",
        content: [
            { type: "status", attrs: { text: "In Progress", color: "blue" } },
            text(" "),
            { type: "date", attrs: { timestamp: String(Date.parse("2026-07-27")) } },
        ],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: taskList renders as GFM checkboxes", () => {
    const adf = doc({
        type: "taskList",
        attrs: { localId: "" },
        content: [
            { type: "taskItem", attrs: { localId: "0", state: "DONE" }, content: [text("Ship it")] },
            { type: "taskItem", attrs: { localId: "1", state: "TODO" }, content: [text("Write docs")] },
        ],
    });
    assert.equal(adfToMarkdown(adf), "- [x] Ship it\n- [ ] Write docs");
});

test("markdownToAdf: a bullet list where every item is a checkbox becomes a taskList", () => {
    const adf = markdownToAdf("- [x] Ship it\n- [ ] Write docs");
    assert.deepEqual(adf.content[0], {
        type: "taskList",
        attrs: { localId: "" },
        content: [
            { type: "taskItem", attrs: { localId: "0", state: "DONE" }, content: [text("Ship it")] },
            { type: "taskItem", attrs: { localId: "1", state: "TODO" }, content: [text("Write docs")] },
        ],
    });
});

test("markdownToAdf: a bullet list with a mix of checkbox and plain items stays a bulletList", () => {
    const adf = markdownToAdf("- [ ] one\n- two");
    assert.equal(adf.content[0].type, "bulletList");
    assert.equal(adf.content[0].content[0].content[0].content[0].text, "[ ] one");
});

test("round-trip: taskList survives adf conversion", () => {
    const adf = doc({
        type: "taskList",
        attrs: { localId: "" },
        content: [{ type: "taskItem", attrs: { localId: "0", state: "TODO" }, content: [text("Write docs")] }],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: decisionList renders with a [decision] marker", () => {
    const adf = doc({
        type: "decisionList",
        attrs: { localId: "" },
        content: [{ type: "decisionItem", attrs: { localId: "0" }, content: [text("Ship Friday")] }],
    });
    assert.equal(adfToMarkdown(adf), "- [decision] Ship Friday");
});

test("markdownToAdf: a bullet list where every item has a [decision] marker becomes a decisionList", () => {
    const adf = markdownToAdf("- [decision] Ship Friday");
    assert.deepEqual(adf.content[0], {
        type: "decisionList",
        attrs: { localId: "" },
        content: [{ type: "decisionItem", attrs: { localId: "0" }, content: [text("Ship Friday")] }],
    });
});

test("round-trip: decisionList survives adf conversion", () => {
    const adf = doc({
        type: "decisionList",
        attrs: { localId: "" },
        content: [{ type: "decisionItem", attrs: { localId: "0" }, content: [text("Ship Friday")] }],
    });
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

test("adfToMarkdown: expand renders as a details/summary collapsible section", () => {
    const adf = doc({
        type: "expand",
        attrs: { title: "Details" },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
    assert.equal(adfToMarkdown(adf), "<details>\n\n<summary>Details</summary>\n\nHidden body\n\n</details>");
});

test("adfToMarkdown: nestedExpand renders the same as expand", () => {
    const adf = doc({
        type: "nestedExpand",
        attrs: { title: "Details" },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
    assert.equal(adfToMarkdown(adf), "<details>\n\n<summary>Details</summary>\n\nHidden body\n\n</details>");
});

test("markdownToAdf: details/summary sentinels become an expand node", () => {
    const adf = markdownToAdf("<details>\n\n<summary>Details</summary>\n\nHidden body\n\n</details>");
    assert.deepEqual(adf.content[0], {
        type: "expand",
        attrs: { title: "Details" },
        content: [{ type: "paragraph", content: [text("Hidden body")] }],
    });
});

test("round-trip: expand survives adf conversion alongside surrounding content", () => {
    const adf = doc(
        { type: "paragraph", content: [text("Before.")] },
        {
            type: "expand",
            attrs: { title: "Details" },
            content: [{ type: "paragraph", content: [text("Hidden body.")] }],
        },
        { type: "paragraph", content: [text("After.")] },
    );
    assert.deepEqual(markdownToAdf(adfToMarkdown(adf)).content, adf.content);
});

const PLUGINS = [mermaidPlugin, umlPlugin];

const MERMAID_ATTRS = {
    extensionKey: "mermaid",
    extensionType: "com.atlassian.confluence.macro.core",
    layout: "default",
    localId: "local-1",
    parameters: {
        macroParams: {
            fileName: "mermaid_1700000000000",
            theme: "default",
            version: "2",
            __bodyContent: { value: JSON.stringify({ diagramDefinition: "graph TD;\nA-->B;" }) },
        },
        macroMetadata: { macroId: "meta-1" },
    },
    schemaVersion: "1",
    title: "Mermaid Integration for Confluence",
};

test("adfToMarkdown: a macro claimed by a plugin renders as a real fence with a details comment", () => {
    const adf = doc({ type: "extension", attrs: MERMAID_ATTRS });
    const markdown = adfToMarkdown(adf, { plugins: PLUGINS });
    assert.match(markdown, /^<!-- confluence-plugin \{"plugin":"mermaid",.*\} -->\n```mermaid\ngraph TD;\nA-->B;\n```$/);
});

test("adfToMarkdown: the details comment doesn't duplicate the diagram source already in the fence", () => {
    const adf = doc({ type: "extension", attrs: MERMAID_ATTRS });
    const markdown = adfToMarkdown(adf, { plugins: PLUGINS });
    const [comment] = markdown.split("\n");
    assert.ok(!comment.includes("diagramDefinition"));
    assert.ok(!comment.includes("graph TD"));
});

test("adfToMarkdown: an extension not claimed by any plugin still falls back to the generic macro fence", () => {
    const adf = doc({ type: "extension", attrs: { extensionKey: "toc", parameters: {} } });
    assert.equal(adfToMarkdown(adf, { plugins: PLUGINS }), '```confluence-macro\n{"extensionKey":"toc","parameters":{}}\n```');
});

test("markdownToAdf: a fence with a plugin details comment reconstructs the exact extension node", () => {
    const adf = doc({ type: "extension", attrs: MERMAID_ATTRS });
    const markdown = adfToMarkdown(adf, { plugins: PLUGINS });
    const back = markdownToAdf(markdown, { plugins: PLUGINS });
    assert.deepEqual(back.content, adf.content);
});

test("round-trip: mermaid and uml plugin macros survive adf conversion side by side", () => {
    const umlAttrs = {
        extensionKey: "uml",
        extensionType: "com.atlassian.confluence.macro.core",
        layout: "default",
        localId: "local-2",
        parameters: {
            macroParams: { __bodyContent: { value: "@startuml\nA -> B\n@enduml" } },
            macroMetadata: { macroId: "meta-2" },
        },
        schemaVersion: "1",
        title: "Mermaid UML Diagram",
    };
    const adf = doc({ type: "extension", attrs: MERMAID_ATTRS }, { type: "extension", attrs: umlAttrs });
    const markdown = adfToMarkdown(adf, { plugins: PLUGINS });
    assert.deepEqual(markdownToAdf(markdown, { plugins: PLUGINS }).content, adf.content);
});

test("markdownToAdf: a fresh fence with no details comment uses the configured default plugin", () => {
    const adf = markdownToAdf("```mermaid\ngraph TD;\nA-->B;\n```", { plugins: PLUGINS, defaults: { mermaid: "uml" } });
    assert.equal(adf.content[0].attrs.extensionKey, "uml");
    assert.equal(adf.content[0].attrs.parameters.macroParams.__bodyContent.value, "graph TD;\nA-->B;");
});

test("markdownToAdf: a fresh fence with no comment and no configured default throws", () => {
    assert.throws(() => markdownToAdf("```mermaid\ngraph TD;\nA-->B;\n```", { plugins: PLUGINS }), InvalidConfigError);
});

test("markdownToAdf: a details comment's plugin id overrides the configured default", () => {
    const details = { plugin: "uml", extensionKey: "uml", parameters: { macroParams: { __bodyContent: { value: "old" } }, macroMetadata: {} } };
    const markdown = `<!-- confluence-plugin ${JSON.stringify(details)} -->\n\`\`\`mermaid\ngraph TD;\nA-->B;\n\`\`\``;
    const adf = markdownToAdf(markdown, { plugins: PLUGINS, defaults: { mermaid: "mermaid" } });
    assert.equal(adf.content[0].attrs.extensionKey, "uml");
});
