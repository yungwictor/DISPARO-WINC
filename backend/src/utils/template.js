const tokenMap = {
  "{nome}": "name",
  "{campo1}": "field1",
  "{campo2}": "field2",
  "{vencimento}": "vencimento",
  "{plano}": "plano"
};

export function renderTemplate(template = "", recipient = {}) {
  return Object.entries(tokenMap).reduce((message, [token, field]) => {
    const value = recipient[field] || "";
    return message.replaceAll(token, value);
  }, template);
}

export function listTemplateVariables() {
  return Object.keys(tokenMap);
}
