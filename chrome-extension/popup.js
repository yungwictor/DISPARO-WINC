const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const DEFAULT_NUMBERS =
  "nome{field1},551912345678{num ban}{field2},field3,field4\nAna,5511991111001,VIP,Renovação,20/05/2026,Premium\nBruno,5511991111002,Lead,Segmento A,21/05/2026,Pro";

const DEFAULT_MESSAGE =
  "Olá [name{field1}], como vai você? Seu prazo expira em [field3] dias e você ainda tem [field4] de crédito. Sua assinatura é a [field5]";

const state = {
  provider: "wpp",
  connected: false,
  prepared: false,
  queue: [],
  total: 0,
  sent: 0,
  failed: 0,
  waiting: 0,
  paused: false,
  cancelled: false,
  running: false,
  attachment: null,
  logs: []
};

function now() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function notify(title, message) {
  chrome.runtime.sendMessage({ type: "WINC_NOTIFY", title, message }).catch(() => {});
}

function log(message, type = "info") {
  const item = { at: now(), message, type };
  state.logs.unshift(item);
  state.logs = state.logs.slice(0, 80);
  renderLogs();
}

function renderLogs() {
  const container = $("#logs");
  const rows = state.logs.map((item) => {
    const row = document.createElement("div");
    row.className = `log-line ${item.type}`;

    const time = document.createElement("time");
    time.textContent = item.at;

    const message = document.createElement("span");
    message.textContent = item.message;

    row.append(time, message);
    return row;
  });

  container.replaceChildren(...rows);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && !/^(\d)\1{7,}$/.test(digits);
}

function parseRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cols = line.split(/[;,]/).map((part) => part.trim());
      const headerLike = index === 0 && /nome|field|num/i.test(line) && !/^\+?\d/.test(cols[0]);
      if (headerLike) return null;
      return {
        name: cols[0] || "",
        phone: normalizePhone(cols[1] || cols[0]),
        field1: cols[2] || "",
        field2: cols[3] || "",
        field3: cols[4] || "",
        field4: cols[5] || "",
        field5: cols[6] || ""
      };
    })
    .filter(Boolean);
}

function validateRows(rows) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  const duplicates = [];

  for (const row of rows) {
    if (!isValidPhone(row.phone)) {
      invalid.push(row);
      continue;
    }

    if (seen.has(row.phone)) {
      duplicates.push(row);
      continue;
    }

    seen.add(row.phone);
    valid.push(row);
  }

  return { valid, invalid, duplicates };
}

function renderMessage(template, row) {
  return String(template || "")
    .replaceAll("[name{field1}]", row.name || row.field1 || "")
    .replaceAll("{nome}", row.name || "")
    .replaceAll("[field1]", row.field1 || "")
    .replaceAll("[field2]", row.field2 || "")
    .replaceAll("[field3]", row.field3 || "")
    .replaceAll("[field4]", row.field4 || "")
    .replaceAll("[field5]", row.field5 || "")
    .replaceAll("{campo1}", row.field1 || "")
    .replaceAll("{campo2}", row.field2 || "")
    .replaceAll("{vencimento}", row.field3 || "")
    .replaceAll("{plano}", row.field5 || "");
}

function randomDelay() {
  const min = Math.max(1, Number($("#minDelay").value || 2));
  const max = Math.max(min, Number($("#maxDelay").value || 10));
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveDraft() {
  const current = await chrome.storage.local.get("settings");
  const previousSettings = current.settings || {};

  await chrome.storage.local.set({
    provider: state.provider,
    connected: state.connected,
    draft: {
      numbers: $("#numbers").value,
      message: $("#message").value,
      attachments: state.attachment ? [state.attachment.name] : [],
      prepared: state.prepared
    },
    settings: {
      ...previousSettings,
      minDelay: Number($("#minDelay").value || 2),
      maxDelay: Number($("#maxDelay").value || 10)
    }
  });
}

async function loadDraft() {
  const data = await chrome.storage.local.get(["provider", "connected", "draft", "settings"]);
  state.provider = data.provider || "wpp";
  state.connected = Boolean(data.connected);
  $("#numbers").value = data.draft?.numbers || DEFAULT_NUMBERS;
  $("#message").value = data.draft?.message || DEFAULT_MESSAGE;
  $("#minDelay").value = data.settings?.minDelay || 2;
  $("#maxDelay").value = data.settings?.maxDelay || 10;
  state.prepared = Boolean(data.draft?.prepared);
  setProvider(state.provider);
  renderConnection();
  renderPrepared();
  log("Extensão DISPARO WINC carregada.");
}

function setProvider(provider) {
  state.provider = provider;
  $$(".tab").forEach((button) => button.classList.toggle("active", button.dataset.provider === provider));
  saveDraft();
}

function renderConnection() {
  $("#statusText").textContent = state.connected ? "Sessão online" : "Sessão offline";
  $("#connectBtn").textContent = state.connected ? "✓" : "⟳";
}

function renderPrepared() {
  $("#sendBtn").disabled = !state.prepared || !state.connected || !state.queue.length;
  $("#sendBtn").classList.toggle("ready", !$("#sendBtn").disabled);
}

function renderProgress() {
  const done = state.sent + state.failed;
  const progress = state.total ? Math.round((done / state.total) * 100) : 0;

  $("#progressBar").style.width = `${progress}%`;
  $("#progressText").textContent = `${progress}%`;
  $("#sentCount").textContent = state.sent;
  $("#failCount").textContent = state.failed;
  $("#waitCount").textContent = state.waiting;
}

function showValidation(result) {
  $("#validationBox").classList.add("show");
  $("#validCount").textContent = result.valid.length;
  $("#invalidCount").textContent = result.invalid.length;
  $("#duplicateCount").textContent = result.duplicates.length;
}

async function prepareQueue() {
  const result = validateRows(parseRows($("#numbers").value));
  showValidation(result);
  state.queue = result.valid;
  state.total = result.valid.length;
  state.sent = 0;
  state.failed = 0;
  state.waiting = result.valid.length;
  state.cancelled = false;
  state.prepared = Boolean(result.valid.length);
  renderProgress();
  renderPrepared();
  await saveDraft();
  log(`Fila preparada: ${result.valid.length} válidos, ${result.invalid.length} inválidos, ${result.duplicates.length} duplicados.`, result.invalid.length ? "warn" : "ok");
}

async function sendQueue() {
  if (!state.connected) {
    log("Conecte uma sessão antes de enviar.", "warn");
    return;
  }

  if (!state.queue.length) {
    await prepareQueue();
  }

  if (!state.queue.length || state.running) return;

  state.running = true;
  state.cancelled = false;
  state.paused = false;
  log("Disparo iniciado em modo seguro simulado.");

  for (const contact of state.queue) {
    if (state.cancelled) break;

    while (state.paused && !state.cancelled) {
      await sleep(300);
    }

    if (state.cancelled) break;

    const delay = randomDelay();
    log(`Aguardando ${delay}s para ${contact.phone}.`);
    await sleep(delay * 650);

    const message = renderMessage($("#message").value, contact);
    const fail = Math.random() < 0.06;

    if (fail) {
      state.failed += 1;
      log(`Falha temporária simulada em ${contact.phone}.`, "err");
    } else {
      state.sent += 1;
      log(`Enviado para ${contact.phone}: ${message.slice(0, 64)}`, "ok");
    }

    state.waiting = Math.max(0, state.total - state.sent - state.failed);
    renderProgress();
  }

  state.running = false;
  state.prepared = false;
  renderPrepared();

  if (state.cancelled) {
    log("Disparo cancelado.", "warn");
    notify("DISPARO WINC", "Campanha cancelada.");
  } else {
    log("Disparo finalizado.", "ok");
    notify("DISPARO WINC", "Campanha finalizada.");
  }
}

function attachEvents() {
  $$(".tab").forEach((button) => button.addEventListener("click", () => setProvider(button.dataset.provider)));

  $("#connectBtn").addEventListener("click", async () => {
    state.connected = !state.connected;
    renderConnection();
    renderPrepared();
    await saveDraft();
    log(state.connected ? "Sessão conectada em modo demo." : "Sessão desconectada.", state.connected ? "ok" : "warn");
  });

  $("#validateBtn").addEventListener("click", () => {
    const result = validateRows(parseRows($("#numbers").value));
    showValidation(result);
    log(`Validação concluída: ${result.valid.length} válidos.`, result.invalid.length ? "warn" : "ok");
  });

  $("#contactsBtn").addEventListener("click", () => {
    $("#numbers").value += "\nCarla,5511991111003,Cliente,Segmento B,22/05/2026,Start";
    log("Contato de exemplo importado.", "ok");
    saveDraft();
  });

  $("#groupsBtn").addEventListener("click", () => {
    $("#numbers").value += "\nGrupo VIP,5511991111004,Grupo,143,25/05/2026,Winc";
    log("Grupo de exemplo importado.", "ok");
    saveDraft();
  });

  $("#quickContacts").addEventListener("click", () => $("#contactsBtn").click());
  $("#clearNumbers").addEventListener("click", () => {
    $("#numbers").value = "";
    log("Lista de números limpa.", "warn");
    saveDraft();
  });

  $("#modelBtn").addEventListener("click", () => {
    $("#numbers").value = DEFAULT_NUMBERS;
    $("#message").value = DEFAULT_MESSAGE;
    log("Modelo carregado.", "ok");
    saveDraft();
  });

  $("#csvInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    $("#numbers").value = text;
    log(`CSV carregado: ${file.name}.`, "ok");
    saveDraft();
  });

  $$(".vars button[data-var]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#message").value += ` ${button.dataset.var}`;
      saveDraft();
    });
  });

  $("#emojiBtn").addEventListener("click", () => {
    $("#message").value += " 🙂";
    saveDraft();
  });

  $("#fileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    state.attachment = file ? { name: file.name, size: file.size, type: file.type } : null;
    $("#fileLabel").textContent = state.attachment ? state.attachment.name : "Selecionar imagem, vídeo, PDF ou áudio";
    $("#fileRatio").textContent = state.attachment ? "[ 1 / 1 ]" : "[ 0 / 1 ]";
    log(state.attachment ? `Arquivo anexado: ${state.attachment.name}.` : "Anexo removido.", "ok");
    saveDraft();
  });

  $("#clearFiles").addEventListener("click", () => {
    state.attachment = null;
    $("#fileInput").value = "";
    $("#fileLabel").textContent = "Selecionar imagem, vídeo, PDF ou áudio";
    $("#fileRatio").textContent = "[ 0 / 1 ]";
    log("Anexos removidos.", "warn");
  });

  $("#prepareBtn").addEventListener("click", prepareQueue);
  $("#sendBtn").addEventListener("click", sendQueue);
  $("#pauseBtn").addEventListener("click", () => {
    state.paused = true;
    log("Disparo pausado.", "warn");
  });
  $("#resumeBtn").addEventListener("click", () => {
    state.paused = false;
    log("Disparo continuado.", "ok");
  });
  $("#cancelBtn").addEventListener("click", () => {
    state.cancelled = true;
    state.waiting = 0;
    renderProgress();
  });

  ["numbers", "message", "minDelay", "maxDelay"].forEach((id) => {
    $(`#${id}`).addEventListener("change", saveDraft);
    $(`#${id}`).addEventListener("input", () => {
      state.prepared = false;
      renderPrepared();
    });
  });
}

attachEvents();
loadDraft();
