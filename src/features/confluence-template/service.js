// Pure: a reusable starting point for `confluence create --file`, with every
// optional frontmatter field present but commented out (see toCreateBody in
// confluence-create/service.js for the field list this mirrors).
export function confluenceTemplate() {
    return `---
title: Placeholder title
# parentId: 123456
# type: page
---

Placeholder page content.
`;
}
