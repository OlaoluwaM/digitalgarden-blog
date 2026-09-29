const COPY_BUTTON_CLASS_NAME = "has-copy-button";

export function initializeCopyButtons() {
  document.querySelectorAll("pre.astro-code").forEach(pre => {
    const alreadyHasCopyButton = pre.classList.contains(COPY_BUTTON_CLASS_NAME);

    if (alreadyHasCopyButton) return;

    const btn = document.createElement("button");
    btn.className = "copy-code-btn";
    btn.type = "button";

    const btnText = "Copy";
    btn.textContent = btnText;

    let btnTimeout: NodeJS.Timeout | undefined;

    const copy = async () => {
      if (btn.disabled) return;

      // I assume a setTimeout is auto cleared once it fires
      if (btnTimeout) {
        clearTimeout(btnTimeout);
        btn.textContent = btnText;
      }

      const code = pre.querySelector("code");

      if (!code) {
        btn.textContent = "No code";
        return;
      }

      // Keep another click from starting a copy while this one is pending.
      btn.disabled = true;

      try {
        const success = await copyTextToClipboard(code.textContent);
        btn.textContent = success ? "Copied!" : "Failed";

        // This just registers the timeout. It doesn't actually wait
        btnTimeout = setTimeout(() => {
          btn.textContent = btnText;
        }, 2000);
      } finally {
        btn.disabled = false;
      }
    };
    btn.addEventListener("click", () => void copy());

    pre.appendChild(btn);
    pre.classList.add(COPY_BUTTON_CLASS_NAME);
  });
}

async function copyTextToClipboard(text: string) {
  // Insecure contexts (plain http) have no navigator.clipboard, whatever
  // the DOM types say.
  const clipboard =
    typeof navigator === "undefined"
      ? undefined
      : (navigator.clipboard as Clipboard | undefined);

  if (typeof clipboard?.writeText !== "function") {
    return copyTextToClipboardWorkaround(text);
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("navigator.clipboard.writeText failed:", e);
    return copyTextToClipboardWorkaround(text);
  }
}

// If there is no clipboard available
function copyTextToClipboardWorkaround(text: string) {
  const textarea = document.createElement("textarea");

  try {
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    textarea.setAttribute("aria-hidden", "true");
    textarea.tabIndex = -1;
    textarea.readOnly = true;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    // Deprecated, but it's the only copy path without the Clipboard API.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("copy");
  } catch (e) {
    console.error("execCommand copy fallback failed:", e);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
