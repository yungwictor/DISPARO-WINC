const defaults = {
  bridgeUrl: "",
  token: "",
  safeMode: true,
  sound: true,
  minDelay: 2,
  maxDelay: 10
};

const $ = (id) => document.getElementById(id);

async function load() {
  const { settings = defaults } = await chrome.storage.local.get("settings");
  $("bridgeUrl").value = settings.bridgeUrl || "";
  $("token").value = settings.token || "";
  $("safeMode").checked = settings.safeMode !== false;
  $("sound").checked = settings.sound !== false;
  $("minDelay").value = settings.minDelay || 2;
  $("maxDelay").value = settings.maxDelay || 10;
}

async function save() {
  await chrome.storage.local.set({
    settings: {
      bridgeUrl: $("bridgeUrl").value.trim(),
      token: $("token").value.trim(),
      safeMode: $("safeMode").checked,
      sound: $("sound").checked,
      minDelay: Number($("minDelay").value || 2),
      maxDelay: Number($("maxDelay").value || 10)
    }
  });

  $("hint").textContent = "Configurações salvas.";
}

$("saveBtn").addEventListener("click", save);
load();
