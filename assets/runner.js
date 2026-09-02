(function () {
  var PLAY_ICON =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 2.612c-.54.313-1.233-.063-1.233-.69V6.598c0-.627.693-1.003 1.233-.69l4.5 2.612c.54.314.54 1.068 0 1.381Z"></path></svg>';

  // Same gutter-stripping as clipboard.js so the sent code has no line numbers.
  function codeText(code) {
    var clone = code.cloneNode(true);
    clone.querySelectorAll("span").forEach(function (span) {
      var style = span.style;
      if (style && (style.userSelect === "none" || style.webkitUserSelect === "none")) {
        span.remove();
      }
    });
    return clone.textContent.replace(/\n$/, "");
  }

  // Parse one SSE frame ({ event, data }) out of the buffer; returns the frame
  // length in bytes or -1 when the buffer holds no complete frame yet.
  function parseFrame(buf, onEvent) {
    var sep = buf.indexOf("\n\n");
    if (sep < 0) return -1;
    var frame = buf.slice(0, sep);
    var event = "message";
    var dataLines = [];
    frame.split("\n").forEach(function (line) {
      if (line.indexOf("event:") === 0) event = line.slice(6).trim();
      else if (line.indexOf("data:") === 0) dataLines.push(line.slice(5).replace(/^ /, ""));
    });
    if (dataLines.length) {
      try {
        onEvent(event, JSON.parse(dataLines.join("\n")));
      } catch (err) {
        /* ignore malformed frame */
      }
    }
    return sep + 2;
  }

  // POST the code to the SSE endpoint and pump chunks to the handlers as they
  // arrive (EventSource is GET-only, so we drive fetch's stream by hand).
  function runStream(lang, code, handlers) {
    return fetch("/api/run/stream", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ lang: lang, code: code }),
    }).then(function (r) {
      if (!r.ok || !r.body) {
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            throw new Error((j && (j.error || j.detail)) || "HTTP " + r.status);
          });
      }
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return;
          buf += decoder.decode(res.value, { stream: true });
          for (var n = parseFrame(buf, dispatch); n >= 0; n = parseFrame(buf, dispatch)) {
            buf = buf.slice(n);
          }
          return pump();
        });
      }
      function dispatch(event, payload) {
        if (event === "stdout" && handlers.onStdout) handlers.onStdout(String(payload.data || ""));
        else if (event === "stderr" && handlers.onStderr) handlers.onStderr(String(payload.data || ""));
        else if (event === "done" && handlers.onDone)
          handlers.onDone({
            exitCode: Number(payload.exitCode || 0),
            timedOut: !!payload.timedOut,
            error: payload.error || "",
          });
      }
      return pump();
    });
  }

  function append(out, text, cls) {
    var span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    out.appendChild(span);
  }

  function addButton(container, code, lang) {
    if (container.querySelector(".run-code-button")) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "run-code-button";
    button.title = "Run";
    button.setAttribute("aria-label", "Run code in sandbox");
    button.innerHTML = PLAY_ICON;

    var out = document.createElement("div");
    out.className = "run-output";

    button.addEventListener("click", function () {
      button.setAttribute("disabled", "true");
      out.style.display = "block";
      out.textContent = "";
      runStream(lang, codeText(code), {
        onStdout: function (chunk) {
          append(out, chunk);
        },
        onStderr: function (chunk) {
          append(out, chunk, "run-err");
        },
        onDone: function (d) {
          append(out, "\nexit=" + d.exitCode + (d.timedOut ? " (timed out)" : "") + "\n");
          if (d.error) append(out, "error: " + d.error + "\n", "run-err");
        },
      })
        .catch(function (e) {
          append(out, "Error: " + (e && e.message ? e.message : String(e)) + "\n", "run-err");
        })
        .then(function () {
          button.removeAttribute("disabled");
        });
    });

    container.appendChild(button);
    if (container.parentElement) {
      container.parentElement.insertBefore(out, container.nextSibling);
    } else {
      container.appendChild(out);
    }
  }

  function decorate(langs) {
    document.querySelectorAll("pre > code").forEach(function (code) {
      var m = (code.className || "").match(/language-([\w+-]+)/);
      if (!m) return;
      var lang = langs[m[1].toLowerCase()];
      if (!lang) return;
      var pre = code.parentElement;
      var container =
        pre.parentElement && pre.parentElement.classList.contains("highlight")
          ? pre.parentElement
          : pre;
      container.classList.add("code-copy-container");
      addButton(container, code, lang);
    });
  }

  function init() {
    fetch("/api/auth/nav", { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (nav) {
        if (!nav || !nav.sections || !nav.sections.run) return;
        return fetch("/api/run/languages", { credentials: "same-origin" }).then(function (r) {
          return r.ok ? r.json() : {};
        });
      })
      .then(function (langs) {
        if (!langs) return;
        var byFence = {};
        Object.keys(langs).forEach(function (canonical) {
          byFence[canonical] = canonical;
          (langs[canonical].aliases || []).forEach(function (alias) {
            byFence[alias] = canonical;
          });
        });
        decorate(byFence);
      })
      .catch(function () {
        /* not signed in / backend unreachable: no run buttons */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
