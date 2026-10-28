'use client';
import { useEffect, useState } from 'react';
import { api, uploadFiles } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';

function Inner() {
  const [f, setF] = useState({ category: 'ring', description: '', budgetMin: '', budgetMax: '' });
  const [files, setFiles] = useState([]);
  const [book, setBook] = useState(false);
  const [c, setC] = useState({ mode: 'video', date: '', slot: '' });
  const [slots, setSlots] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  useEffect(() => { if (c.date) api(`/consultations/slots?date=${c.date}`).then((r) => setSlots(r.slots)).catch(() => setSlots([])); }, [c.date]);

  async function submit(e) {
    e.preventDefault(); setMsg(null); setBusy(true);
    try {
      const { request } = await api('/custom-requests', { method: 'POST', body: {
        category: f.category, description: f.description, files: files.map((x) => x.url),
        ...(f.budgetMin ? { budgetMin: Number(f.budgetMin) } : {}), ...(f.budgetMax ? { budgetMax: Number(f.budgetMax) } : {}) } });
      if (book) await api('/consultations', { method: 'POST', body: { ...c, request: request._id } });
      setMsg({ ok: book ? 'Request sent and consultation booked. We will confirm shortly.' : 'Request sent. A designer will contact you soon.' });
      setF({ ...f, description: '' }); setFiles([]);
    } catch (er) { setMsg({ err: er.message }); }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-4xl text-navy">Custom design request</h1>
      <p className="mt-2 text-gray-600">Have a sketch, a photo or an idea? Tell us — our designers will turn it into CAD for your approval.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <label className="block"><span className="label">Type</span><select className="input mt-1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['ring', 'pendant', 'earring', 'necklace', 'bangle', 'other'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="block"><span className="label">Describe your idea</span><textarea required minLength={10} maxLength={3000} rows={5} className="input mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Budget from (₹)</span><input type="number" min="0" className="input mt-1" value={f.budgetMin} onChange={(e) => setF({ ...f, budgetMin: e.target.value })} /></label>
          <label><span className="label">Budget to (₹)</span><input type="number" min="0" className="input mt-1" value={f.budgetMax} onChange={(e) => setF({ ...f, budgetMax: e.target.value })} /></label>
        </div>
        <label className="block"><span className="label">Sketch or photos (JPG/PNG/WebP/PDF, max 5)</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block text-sm" onChange={async (e) => { try { setFiles(await uploadFiles(e.target.files)); } catch (er) { setMsg({ err: er.message }); } }} /></label>
        {files.length > 0 && <p className="text-xs text-emerald-700">{files.length} file(s) uploaded</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={book} onChange={(e) => setBook(e.target.checked)} /> Also book a designer consultation</label>
        {book && (
          <div className="space-y-3 rounded-xl bg-ivory p-4">
            <div className="flex gap-4 text-sm">{[['video', 'Video call'], ['store', 'Store visit']].map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="radio" checked={c.mode === k} onChange={() => setC({ ...c, mode: k })} /> {l}</label>)}</div>
            <label className="block"><span className="label">Date</span><input type="date" required min={tomorrow} className="input mt-1" value={c.date} onChange={(e) => setC({ ...c, date: e.target.value, slot: '' })} /></label>
            {c.date && <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time slot">{slots.map((s) => <button type="button" key={s.slot} disabled={!s.available} aria-pressed={c.slot === s.slot} onClick={() => setC({ ...c, slot: s.slot })} className={`rounded-full border px-3 py-1 text-sm ${c.slot === s.slot ? 'border-gold bg-gold/20 font-semibold' : 'bg-white'} disabled:opacity-40`}>{s.slot}</button>)}</div>}
          </div>)}
        {msg?.err && <p role="alert" className="text-sm text-red-700">{msg.err}</p>}
        {msg?.ok && <p role="status" className="text-sm text-emerald-800">{msg.ok}</p>}
        <button className="btn btn-navy w-full" disabled={busy || (book && !c.slot)}>{busy ? 'Sending…' : 'Send request'}</button>
      </form>
    </div>
  );
}
export default function CustomClient() { return <RequireAuth><div className="paper-page min-h-[80vh]"><Inner /></div></RequireAuth>; }
