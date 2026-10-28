const API = process.env.API_URL || 'http://localhost:4000';

/** Server-side fetch to the API. Returns null (never throws) so pages degrade gracefully if the API is down. */
export async function sfetch(path, revalidate = 60) {
  try {
    const res = await fetch(`${API}/api${path}`, { next: { revalidate } });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
