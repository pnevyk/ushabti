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
