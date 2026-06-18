(() => {
  if (window.__DISPARO_WINC_CONTENT__) return;
  window.__DISPARO_WINC_CONTENT__ = true;

  const badge = document.createElement("div");
  badge.textContent = "DISPARO WINC";
  badge.style.cssText = [
    "position:fixed",
    "right:18px",
    "bottom:18px",
    "z-index:999999",
    "padding:9px 12px",
    "border:1px solid rgba(39,255,136,.45)",
    "border-radius:12px",
    "background:rgba(2,6,4,.82)",
    "color:#00ff01",
    "font:800 11px/1.1 system-ui,sans-serif",
    "letter-spacing:.16em",
    "box-shadow:0 0 28px rgba(39,255,136,.22)",
    "backdrop-filter:blur(14px)",
    "pointer-events:none"
  ].join(";");

  document.documentElement.appendChild(badge);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "WINC_WHATSAPP_STATUS") {
      const loaded = Boolean(document.querySelector("[contenteditable='true']")) || document.title.toLowerCase().includes("whatsapp");
      sendResponse({ ok: true, loaded, title: document.title });
      return true;
    }
    return false;
  });
})();
