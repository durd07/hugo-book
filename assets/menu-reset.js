(function() {
  // The file tree is the actual scroll container (`.book-menu-content` is fixed
  // and clipped); fall back to it for the menu-bundle layout.
  var scroller = document.querySelector("aside .menu-filetree") ||
                 document.querySelector("aside .book-menu-content");
  if (!scroller) return;

  // Persist which sections are expanded so navigating between pages doesn't
  // collapse branches the user opened. The current page's ancestors are already
  // rendered open by Hugo, and we never force those closed. Do this first so the
  // tree has its final height before we restore the scroll position.
  var KEY = "menu.expanded";
  var toggles = scroller.querySelectorAll('input.toggle[id]');

  if (toggles.length) {
    var saved;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { saved = {}; }

    toggles.forEach(function(t) {
      // t.checked reflects Hugo's default (current branch open). Only re-open
      // extra sections the user had expanded; don't close anything here.
      if (!t.checked && saved[t.id] === true) {
        t.checked = true;
      }
    });

    function save() {
      var state = {};
      toggles.forEach(function(t) { state[t.id] = t.checked; });
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }

    toggles.forEach(function(t) { t.addEventListener("change", save); });
    addEventListener("beforeunload", save);
  }

  // Restore scroll position to avoid flicker on navigation.
  addEventListener("beforeunload", function() {
    localStorage.setItem("menu.scrollTop", scroller.scrollTop);
  });
  scroller.scrollTop = localStorage.getItem("menu.scrollTop");

  // Make sure the current page's entry is visible: if the restored scroll left
  // it out of view, scroll it to the centre of the visible tree.
  var active = scroller.querySelector("a.active");
  if (active) {
    var sRect = scroller.getBoundingClientRect();
    var aRect = active.getBoundingClientRect();
    if (aRect.top < sRect.top || aRect.bottom > sRect.bottom) {
      scroller.scrollTop += (aRect.top - sRect.top) - (scroller.clientHeight - aRect.height) / 2;
    }
  }
})();
