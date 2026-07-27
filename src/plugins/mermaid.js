import { randomUUID } from "node:crypto";

// "Mermaid Integration for Confluence" app. Diagram source is JSON-wrapped:
// macroParams.__bodyContent.value is itself a JSON string holding
// { diagramDefinition }.
export const mermaidPlugin = {
    id: "mermaid",
    target: "mermaid",
    detect(node) {
        return node.attrs?.extensionKey === "mermaid";
    },
    decode(node) {
        const parsed = JSON.parse(node.attrs.parameters.macroParams.__bodyContent.value);
        return { source: parsed.diagramDefinition, details: node.attrs };
    },
    encode(source, details) {
        if (details) {
            const attrs = structuredClone(details);
            attrs.parameters.macroParams.__bodyContent.value = JSON.stringify({ diagramDefinition: source });
            return attrs;
        }
        return {
            layout: "default",
            extensionType: "com.atlassian.confluence.macro.core",
            extensionKey: "mermaid",
            localId: randomUUID(),
            parameters: {
                macroParams: {
                    fileName: `mermaid_${Date.now()}`,
                    theme: "default",
                    version: "2",
                    __bodyContent: { value: JSON.stringify({ diagramDefinition: source }) },
                },
                macroMetadata: { macroId: randomUUID() },
            },
            schemaVersion: "1",
            title: "Mermaid Integration for Confluence",
        };
    },
};
