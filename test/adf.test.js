import { test } from "node:test";
import assert from "node:assert/strict";
import { adfToMarkdown, markdownToAdf } from "../src/shared/adf.js";

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
