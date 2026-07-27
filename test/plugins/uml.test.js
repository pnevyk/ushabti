import { test } from "node:test";
import assert from "node:assert/strict";
import { umlPlugin } from "../../src/plugins/uml.js";

const attrs = {
    layout: "default",
    extensionType: "com.atlassian.confluence.macro.core",
    extensionKey: "uml",
    localId: "local-2",
    parameters: {
        macroParams: { __bodyContent: { value: "@startuml\nA -> B\n@enduml" } },
        macroMetadata: { macroId: "meta-2" },
    },
    schemaVersion: "1",
    title: "Mermaid UML Diagram",
};

test("umlPlugin.detect matches nodes with extensionKey uml", () => {
    assert.equal(umlPlugin.detect({ attrs }), true);
    assert.equal(umlPlugin.detect({ attrs: { extensionKey: "mermaid" } }), false);
    assert.equal(umlPlugin.detect({ attrs: {} }), false);
});

test("umlPlugin.decode reads the raw diagram source", () => {
    const { source, details } = umlPlugin.decode({ attrs });
    assert.equal(source, "@startuml\nA -> B\n@enduml");
    assert.equal(details, attrs);
});

test("umlPlugin.encode with details splices the new source back in, preserving everything else", () => {
    const encoded = umlPlugin.encode("@startuml\nA -> C\n@enduml", attrs);
    assert.equal(encoded.parameters.macroParams.__bodyContent.value, "@startuml\nA -> C\n@enduml");
    assert.equal(encoded.localId, "local-2");
    assert.equal(encoded.parameters.macroMetadata.macroId, "meta-2");
    assert.equal(encoded.title, "Mermaid UML Diagram");
    assert.equal(encoded.schemaVersion, "1");
    assert.notEqual(encoded, attrs);
});

test("umlPlugin.encode without details builds fresh attrs", () => {
    const encoded = umlPlugin.encode("@startuml\nA -> B\n@enduml", null);
    assert.equal(encoded.layout, "default");
    assert.equal(encoded.extensionType, "com.atlassian.confluence.macro.core");
    assert.equal(encoded.extensionKey, "uml");
    assert.equal(typeof encoded.localId, "string");
    assert.ok(encoded.localId.length > 0);
    assert.equal(encoded.parameters.macroParams.__bodyContent.value, "@startuml\nA -> B\n@enduml");
    assert.equal(typeof encoded.parameters.macroMetadata.macroId, "string");
    assert.equal(encoded.schemaVersion, "1");
    assert.equal(encoded.title, "Mermaid UML Diagram");
});

test("umlPlugin.decode/encode round-trip via detect", () => {
    const node = { type: "extension", attrs };
    assert.equal(umlPlugin.detect(node), true);
    const { source, details } = umlPlugin.decode(node);
    const encoded = umlPlugin.encode(source, details);
    assert.deepEqual(encoded, attrs);
});
