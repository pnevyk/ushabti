# Confluence macro plugins

Confluence's macro system round-trips through ushabti as opaque JSON by default (see [Macros (Confluence extensions)](adf-markdown.md#macros-confluence-extensions)) — safe for any macro, but unreadable and unauthorable. A plugin is an opt-in for one specific macro shape to instead round-trip as real, editable markdown. Today, both available plugins target mermaid diagrams.

## Available plugins

| id | Confluence app | Diagram fence produced |
|---|---|---|
| `mermaid` | Mermaid Integration for Confluence | ` ```mermaid ` |
| `uml` | Mermaid UML Diagram | ` ```mermaid ` |

Both plugins share the `mermaid` target — they decode to the same fence language, since both are mermaid diagrams from the reader's perspective, even though they're different macros (different Confluence apps, different underlying JSON shape) under the hood.

## Which plugin encodes a fresh fence

Downloading a page always decodes a macro through whichever plugin matches its `extensionKey`, and stamps a `<!-- confluence-plugin {"plugin":"<id>",...} -->` comment above the fence recording exactly which one produced it. Uploading always honors that comment over any config, so editing an existing diagram never silently swaps its underlying macro.

A brand-new, hand-authored fence has no such comment yet. For that case only, [`[confluence.plugins]`](configuration.md#confluenceplugins) configures a default id per target — e.g. which of `mermaid`/`uml` a fresh ` ```mermaid ` fence encodes to. Once that fresh fence round-trips through a download, it picks up its own details comment and behaves like any other existing diagram from then on.
