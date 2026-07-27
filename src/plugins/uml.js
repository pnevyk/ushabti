import { randomUUID } from "node:crypto";

// "Mermaid UML Diagram" app. Diagram source is raw:
// macroParams.__bodyContent.value is the mermaid source directly.
export const umlPlugin = {
    id: "uml",
    target: "mermaid",
    detect(node) {
        return node.attrs?.extensionKey === "uml";
    },
    decode(node) {
        return { source: node.attrs.parameters.macroParams.__bodyContent.value, details: node.attrs };
    },
    encode(source, details) {
        if (details) {
            const attrs = structuredClone(details);
            attrs.parameters.macroParams.__bodyContent.value = source;
            return attrs;
        }
        return {
            layout: "default",
            extensionType: "com.atlassian.confluence.macro.core",
            extensionKey: "uml",
            localId: randomUUID(),
            parameters: {
                macroParams: { __bodyContent: { value: source } },
                macroMetadata: { macroId: randomUUID() },
            },
            schemaVersion: "1",
            title: "Mermaid UML Diagram",
        };
    },
};
