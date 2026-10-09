# ushabti documentation

ushabti is a CLI tool that automates little engineering tasks: fetching PR review comments, managing Jira tickets, downloading and updating Confluence pages.
It fetches into local files and updates from local files, so an AI agent can reason over plain data instead of a live API.

- **[Getting started](getting-started.md)** — install ushabti and set up its config.
- **How-to guides** — goal-oriented walkthroughs for specific use cases.
  - [Implement a ticket](how-to/implement-a-ticket.md)
  - [Download Confluence pages](how-to/download-confluence-pages.md)
  - [Address review feedback](how-to/address-review-feedback.md)
  - [Create a ticket](how-to/create-a-ticket.md)
  - [Batch manage tickets](how-to/batch-manage-tickets.md)
  - [Feed PR reviews to a compound engineering step](how-to/feed-pr-reviews-to-compound-engineering.md)
  - [Estimate tasks with the UI](how-to/estimate-tasks.md)
- **Upgrading** — what changes between releases and how to migrate.
  - [Upgrading to 0.2.0](upgrading/0.2.0.md)
- **Reference** — exhaustive lookup material.
  - [Configuration](reference/configuration.md)
  - [ADF ↔ Markdown mapping](reference/adf-markdown.md)
  - [Confluence macro plugins](reference/plugins.md)

For flag-level detail on any command, run `ushabti <group> <command> --help`.
