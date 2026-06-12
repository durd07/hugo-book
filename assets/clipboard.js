(function () {
  const COPY_ICON =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>';
  const CHECK_ICON =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L1.97 8.28a.75.75 0 0 1 1.06-1.06L6 10.19l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>';

  // Extract code text while dropping the non-selectable line-number gutter
  // that Hugo/Chroma renders inline (style "user-select:none").
  function codeText(code) {
    const clone = code.cloneNode(true);
    clone.querySelectorAll("span").forEach(function (span) {
      const style = span.style;
      if (style && (style.userSelect === "none" || style.webkitUserSelect === "none")) {
        span.remove();
      }
    });
    return clone.textContent.replace(/\n$/, "");
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      /* ignore */
    }
    document.body.removeChild(textarea);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function addButton(pre) {
    const code = pre.querySelector("code");
    if (!code) {
      return;
    }

    const container =
      pre.parentElement && pre.parentElement.classList.contains("highlight")
        ? pre.parentElement
        : pre;
    container.classList.add("code-copy-container");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code-button";
    button.title = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.innerHTML = COPY_ICON;

    let resetTimer = null;
    button.addEventListener("click", function () {
      copyText(codeText(code)).then(function () {
        button.classList.add("copied");
        button.innerHTML = CHECK_ICON;
        button.title = "Copied!";
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          button.classList.remove("copied");
          button.innerHTML = COPY_ICON;
          button.title = "Copy";
        }, 2000);
      });
    });

    container.appendChild(button);
  }

  function init() {
    document.querySelectorAll("pre > code").forEach(function (code) {
      addButton(code.parentElement);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
