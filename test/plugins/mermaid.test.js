import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidPlugin } from "../../src/plugins/mermaid.js";

const attrs = {
    layout: "default",
    extensionType: "com.atlassian.confluence.macro.core",
    extensionKey: "mermaid",
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

test("mermaidPlugin.detect matches nodes with extensionKey mermaid", () => {
    assert.equal(mermaidPlugin.detect({ attrs }), true);
    assert.equal(mermaidPlugin.detect({ attrs: { extensionKey: "uml" } }), false);
    assert.equal(mermaidPlugin.detect({ attrs: {} }), false);
});

test("mermaidPlugin.decode unwraps the JSON-wrapped diagram source", () => {
    const { source, details } = mermaidPlugin.decode({ attrs });
    assert.equal(source, "graph TD;\nA-->B;");
    assert.notEqual(details, attrs); // cloned, not the original attrs
    assert.equal(details.parameters.macroParams.__bodyContent, undefined); // duplicates the fence, dropped
    assert.equal(details.parameters.macroParams.fileName, "mermaid_1700000000000");
    assert.equal(details.parameters.macroMetadata.macroId, "meta-1");
});

test("mermaidPlugin.encode with details splices the new source back in, preserving everything else", () => {
    const encoded = mermaidPlugin.encode("graph TD;\nA-->C;", attrs);
    assert.deepEqual(JSON.parse(encoded.parameters.macroParams.__bodyContent.value), { diagramDefinition: "graph TD;\nA-->C;" });
    assert.equal(encoded.localId, "local-1");
    assert.equal(encoded.parameters.macroMetadata.macroId, "meta-1");
    assert.equal(encoded.parameters.macroParams.fileName, "mermaid_1700000000000");
    assert.equal(encoded.parameters.macroParams.theme, "default");
    assert.equal(encoded.parameters.macroParams.version, "2");
    assert.equal(encoded.title, "Mermaid Integration for Confluence");
    assert.equal(encoded.schemaVersion, "1");
    assert.notEqual(encoded, attrs); // cloned, not mutated in place
});

test("mermaidPlugin.encode without details builds fresh attrs", () => {
    const encoded = mermaidPlugin.encode("graph TD;\nA-->B;", null);
    assert.equal(encoded.layout, "default");
    assert.equal(encoded.extensionType, "com.atlassian.confluence.macro.core");
    assert.equal(encoded.extensionKey, "mermaid");
    assert.equal(typeof encoded.localId, "string");
    assert.ok(encoded.localId.length > 0);
    assert.equal(encoded.parameters.macroParams.theme, "default");
    assert.equal(encoded.parameters.macroParams.version, "2");
    assert.match(encoded.parameters.macroParams.fileName, /^mermaid_\d+$/);
    assert.deepEqual(JSON.parse(encoded.parameters.macroParams.__bodyContent.value), { diagramDefinition: "graph TD;\nA-->B;" });
    assert.equal(typeof encoded.parameters.macroMetadata.macroId, "string");
    assert.equal(encoded.schemaVersion, "1");
    assert.equal(encoded.title, "Mermaid Integration for Confluence");
});

test("mermaidPlugin.decode/encode round-trip via detect", () => {
    const node = { type: "extension", attrs };
    assert.equal(mermaidPlugin.detect(node), true);
    const { source, details } = mermaidPlugin.decode(node);
    const encoded = mermaidPlugin.encode(source, details);
    assert.deepEqual(encoded, attrs);
});
