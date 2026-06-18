const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333/api";

let token = sessionStorage.getItem("winc_token") || "";

export function setToken(nextToken) {
  token = nextToken || "";
  if (token) {
    sessionStorage.setItem("winc_token", token);
  } else {
    sessionStorage.removeItem("winc_token");
  }
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.message || "Erro na requisicao");
  }

  return data;
}

export const api = {
  url: API_URL,
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body || {}) }),
  upload: (path, formData) => request(path, { method: "POST", body: formData })
};
