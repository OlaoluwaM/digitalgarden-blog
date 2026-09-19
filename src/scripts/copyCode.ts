const COPY_BUTTON_CLASS_NAME = "has-copy-button"; // TODO: Needs a better name

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

    btn.addEventListener("click", async () => {
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
    });

    pre.appendChild(btn);
    pre.classList.add(COPY_BUTTON_CLASS_NAME);
  });
}

async function copyTextToClipboard(text: string) {
  const clipboardIsAvailable =
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function";

  if (!clipboardIsAvailable) return copyTextToClipboardWorkaround(text);

  try {
    await navigator.clipboard.writeText(text);
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
    return document.execCommand("copy");
  } catch (e) {
    console.error("execCommand copy fallback failed:", e);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
