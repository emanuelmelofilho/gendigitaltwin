export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const hasBody = method !== 'GET';
  const res = await fetch(`/api${path}`, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body ?? {}) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.details?.map((d) => `${d.path ? `${d.path}: ` : ''}${d.message}`).join('; ');
    throw new ApiError(detail ? `${data.error} (${detail})` : data?.error ?? `Erro ${res.status}`, res.status, data?.details);
  }
  return data;
}
