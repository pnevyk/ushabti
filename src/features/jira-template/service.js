// Pure: a reusable starting point for `jira create --file`, with every
// optional frontmatter field present but commented out (see toIssueFields in
// jira-create/service.js for the field list this mirrors).
export function jiraTemplate() {
    return `---
title: Placeholder title
type: Story
# parent: ABC-100
# assignee: 5f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c
# storyPoints: 3
# sprint: 42
---

Placeholder description.
`;
}
