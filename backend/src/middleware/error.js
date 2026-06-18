export function notFound(req, res) {
  res.status(404).json({ message: "Rota nao encontrada" });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Erro interno",
    status
  });
}
