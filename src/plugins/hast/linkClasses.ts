import { defineHastPlugin } from "satteri";

export const hastLinkClassesPlugin = defineHastPlugin({
  name: "hast-link-classes",
  element: {
    filter: ["a"],
    visit(node) {
      const { href, className: existingNodeClasses = [] } = node.properties;

      if (href === undefined) return node;
      const isExternalLink = isExternalHref(href);

      if (isExternalLink) {
        return {
          ...node,
          properties: {
            ...node.properties,
            target: "_blank",
            className: appendClassNames(existingNodeClasses, ["external-link"]),
          },
        };
      }

      return {
        ...node,
        properties: {
          ...node.properties,
          className: appendClassNames(existingNodeClasses, ["internal-link"]),
        },
      };
    },
  },
});

function isExternalHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === "") return false;
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return false;
  }
  // Any explicit scheme (http, https, mailto, etc) is treated as external.
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}

// Keep existing classes in order and add only the missing ones.
function appendClassNames(existing: string[], added: string[]): string[] {
  return [...new Set([...existing, ...added])];
}
