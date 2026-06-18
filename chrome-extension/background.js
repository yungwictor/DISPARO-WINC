const DEFAULTS = {
  provider: "wpp",
  connected: false,
  settings: {
    bridgeUrl: "",
    token: "",
    safeMode: true,
    sound: true,
    minDelay: 2,
    maxDelay: 10
  },
  draft: {
    numbers: "nome{field1},551912345678{num ban}{field2},field3,field4\nAna,5511991111001,VIP,Renovação,20/05/2026,Premium\nBruno,5511991111002,Lead,Segmento A,21/05/2026,Pro",
    message: "Olá [name{field1}], como vai você? Seu prazo expira em [field3] dias e você ainda tem [field4] de crédito. Sua assinatura é a [field5]",
    attachments: [],
    prepared: false
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const next = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (current[key] === undefined) next[key] = value;
  }

  if (Object.keys(next).length) {
    await chrome.storage.local.set(next);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "WINC_NOTIFY") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icon128.png",
      title: message.title || "DISPARO WINC",
      message: message.message || "Evento concluído"
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "WINC_GET_TAB") {
    sendResponse({
      ok: true,
      tabId: sender.tab?.id,
      url: sender.tab?.url || ""
    });
    return true;
  }

  return false;
});
