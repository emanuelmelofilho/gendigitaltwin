export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new HttpError(400, 'Dados inválidos', details);
  }
  return result.data;
}

// Cookies SameSite=Lax + exigir JSON nas escritas impede formulários de outros sites (CSRF).
export function requireJsonOnWrite(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.is('application/json')) return next();
  next(new HttpError(415, 'Envie o corpo como application/json'));
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
}
