const TOKEN_KEY = 'fringlale_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export async function api(path, { method = 'GET', body, signal, raw } = {}) {
  const token = typeof window !== 'undefined' ? getToken() : null;
  const res = await fetch(`/api${path}`, {
    method, signal,
    headers: { ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error?.message || 'Something went wrong', res.status, data?.error?.code);
  return data;
}

export async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) throw new ApiError('Download failed', res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadFiles(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append('files', f));
  return (await api('/uploads', { method: 'POST', body: fd })).files;
}
