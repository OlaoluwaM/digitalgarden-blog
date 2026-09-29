// Marks titles that already have toggle listeners, so re-running is safe.
const CALLOUT_TOGGLE_CLASS_NAME = "has-callout-toggle";

export function initializeCalloutToggles() {
  document
    .querySelectorAll<HTMLElement>(".callout.is-collapsible")
    .forEach(callout => {
      const title = callout.querySelector<HTMLElement>(
        ":scope > .callout-title"
      );
      if (!title) return;

      const alreadyProcessed = title.classList.contains(
        CALLOUT_TOGGLE_CLASS_NAME
      );

      if (alreadyProcessed) return;

      title.setAttribute("tabindex", "0");
      title.setAttribute("role", "button");
      title.setAttribute(
        "aria-expanded",
        callout.classList.contains("is-collapsed") ? "false" : "true"
      );

      title.addEventListener("click", () => toggleCallout(title, callout));
      title.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCallout(title, callout);
        }
      });
      title.classList.add(CALLOUT_TOGGLE_CLASS_NAME);
    });
}

function toggleCallout(title: HTMLElement, calloutElem: HTMLElement) {
  const isCollapsed = calloutElem.classList.toggle("is-collapsed");
  title.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
}
