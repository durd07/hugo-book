/*
 * Diagram / image viewer enhancement.
 *
 * Adds a small hover button to rendered Mermaid diagrams, PlantUML images and
 * normal content images. Clicking it (or double-clicking a Mermaid diagram)
 * opens the media in a fullscreen lightbox with wheel-zoom + drag-pan.
 *
 * Pure progressive enhancement: Mermaid/PlantUML render asynchronously, so we
 * attach once each target appears (initial scan + a short-lived
 * MutationObserver) and skip anything already processed.
 */
(function () {
  "use strict";
  if (window.__mediaZoom) return;
  window.__mediaZoom = true;

  // ---- Shared fullscreen lightbox (built lazily on first use) ---------------
  var lb = null;
  function lightbox() {
    if (lb) return lb;

    var overlay = document.createElement("div");
    overlay.className = "mmz-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="mmz-backdrop"></div>' +
      '<div class="mmz-stage"><div class="mmz-zoom"></div></div>' +
      '<div class="mmz-tools">' +
        '<button type="button" class="mmz-btn" data-act="out" title="Zoom out (-)" aria-label="Zoom out">\u2212</button>' +
        '<button type="button" class="mmz-btn" data-act="reset" title="Fit (0)" aria-label="Fit to screen">\u2922</button>' +
        '<button type="button" class="mmz-btn" data-act="in" title="Zoom in (+)" aria-label="Zoom in">+</button>' +
        '<button type="button" class="mmz-btn mmz-close" data-act="close" title="Close (Esc)" aria-label="Close">\u2715</button>' +
      '</div>';
    document.body.appendChild(overlay);

    var stage = overlay.querySelector(".mmz-stage");
    var zoom = overlay.querySelector(".mmz-zoom");
    var st = { scale: 1, x: 0, y: 0, w: 1, h: 1 };

    function apply() {
      zoom.style.transform =
        "translate(" + st.x + "px," + st.y + "px) scale(" + st.scale + ")";
    }
    function fit() {
      var sb = stage.getBoundingClientRect();
      var pad = 48;
      var s = Math.min((sb.width - pad) / st.w, (sb.height - pad) / st.h);
      if (!isFinite(s) || s <= 0) s = 1;
      st.scale = s;
      st.x = (sb.width - st.w * s) / 2;
      st.y = (sb.height - st.h * s) / 2;
      apply();
    }
    function zoomBy(factor, px, py) {
      var sb = stage.getBoundingClientRect();
      var cx = px == null ? sb.width / 2 : px - sb.left;
      var cy = py == null ? sb.height / 2 : py - sb.top;
      var ns = Math.max(0.1, Math.min(16, st.scale * factor));
      var k = ns / st.scale;
      st.x = cx - k * (cx - st.x);
      st.y = cy - k * (cy - st.y);
      st.scale = ns;
      apply();
    }

    // Accepts a rendered <svg> (Mermaid) or an <img> (PlantUML / content image).
    function open(media) {
      var tag = (media.tagName || "").toLowerCase();
      var node, w, h;
      if (tag === "svg") {
        var vb = media.viewBox && media.viewBox.baseVal;
        var box = media.getBoundingClientRect();
        w = (vb && vb.width) || box.width || 800;
        h = (vb && vb.height) || box.height || 600;
        node = media.cloneNode(true);
        node.setAttribute("width", w);
        node.setAttribute("height", h);
      } else {
        w = media.naturalWidth || media.getBoundingClientRect().width || 800;
        h = media.naturalHeight || media.getBoundingClientRect().height || 600;
        node = new Image();
        node.src = media.currentSrc || media.src;
        node.alt = media.alt || "";
        node.draggable = false;
      }
      node.style.width = w + "px";
      node.style.height = h + "px";
      node.style.maxWidth = "none";
      st.w = w;
      st.h = h;
      zoom.innerHTML = "";
      zoom.appendChild(node);

      overlay.hidden = false;
      document.body.classList.add("mmz-lock");
      requestAnimationFrame(fit);
    }
    function close() {
      overlay.hidden = true;
      document.body.classList.remove("mmz-lock");
      zoom.innerHTML = "";
    }

    overlay.querySelector(".mmz-backdrop").addEventListener("click", close);
    overlay.querySelector(".mmz-tools").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "in") zoomBy(1.25);
      else if (act === "out") zoomBy(0.8);
      else if (act === "reset") fit();
      else if (act === "close") close();
    });

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY);
    }, { passive: false });

    var drag = null;
    stage.addEventListener("pointerdown", function (e) {
      drag = { x: e.clientX, y: e.clientY, ox: st.x, oy: st.y };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      stage.classList.add("grabbing");
    });
    stage.addEventListener("pointermove", function (e) {
      if (!drag) return;
      st.x = drag.ox + (e.clientX - drag.x);
      st.y = drag.oy + (e.clientY - drag.y);
      apply();
    });
    function endDrag() { drag = null; stage.classList.remove("grabbing"); }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    window.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-" || e.key === "_") zoomBy(0.8);
      else if (e.key === "0") fit();
    });
    window.addEventListener("resize", function () { if (!overlay.hidden) fit(); });

    lb = { open: open };
    return lb;
  }

  var ICON_ZOOM =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/>' +
    '<path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

  function addToolbar(host, getMedia, withDblclick) {
    host.classList.add("mmz-host");
    var bar = document.createElement("div");
    bar.className = "mmz-toolbar";
    bar.innerHTML =
      '<button type="button" class="mmz-icon" data-act="zoom" title="Zoom / fullscreen" aria-label="Zoom fullscreen">' +
      ICON_ZOOM + "</button>";
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      var m = getMedia();
      if (m) lightbox().open(m);
    });
    host.appendChild(bar);

    if (withDblclick) {
      var m0 = getMedia();
      if (m0) m0.addEventListener("dblclick", function () {
        var m = getMedia();
        if (m) lightbox().open(m);
      });
    }
  }

  // ---- Mermaid diagrams -----------------------------------------------------
  function enhanceMermaid(host) {
    if (host.dataset.mmzReady) return;
    if (!host.querySelector(":scope > svg")) return;
    host.dataset.mmzReady = "1";
    addToolbar(host, function () { return host.querySelector(":scope > svg"); }, true);
  }

  // ---- PlantUML + normal images ---------------------------------------------
  function wrapImg(img) {
    var span = document.createElement("span");
    span.className = "mmz-host mmz-img";
    var parent = img.parentNode;
    parent.insertBefore(span, img);
    span.appendChild(img);
    return span;
  }

  function enhanceImage(img) {
    var s = img.dataset.mmzReady;
    if (s === "1" || s === "skip") return;
    if (img.closest(".mmz-overlay") || img.closest(".mmz-toolbar")) return;

    // Wait for the image to load so we know its real size (and can skip ones
    // that fail, e.g. an unreachable PlantUML endpoint).
    if (!img.complete || !img.naturalWidth) {
      if (s !== "wait") {
        img.dataset.mmzReady = "wait";
        img.addEventListener("load", function () {
          img.dataset.mmzReady = "";
          enhanceImage(img);
        }, { once: true });
        img.addEventListener("error", function () {
          img.dataset.mmzReady = "skip";
        }, { once: true });
      }
      return;
    }
    // Leave tiny images (icons, badges, emoji) alone.
    if (img.naturalWidth < 48 && img.naturalHeight < 48) {
      img.dataset.mmzReady = "skip";
      return;
    }
    img.dataset.mmzReady = "1";
    var host = wrapImg(img);
    addToolbar(host, function () { return img; }, false);
  }

  function scan() {
    var ms = document.querySelectorAll(".markdown .mermaid");
    for (var i = 0; i < ms.length; i++) enhanceMermaid(ms[i]);
    var imgs = document.querySelectorAll(".markdown img");
    for (var j = 0; j < imgs.length; j++) enhanceImage(imgs[j]);
  }

  function start() {
    scan();
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; scan(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // Catch late async renders, then stop observing.
    setTimeout(scan, 600);
    setTimeout(scan, 2000);
    setTimeout(function () { mo.disconnect(); scan(); }, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
