export const metadata = { title: 'Contact' };
export default function Page() {
  return (
    <div className="paper-page min-h-[80vh]"><div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-6xl text-[#3A0F1B]">Contact us</h1>
      <p className="mt-4 text-[#3A0F1B]/70">Questions about a design, an order or an exchange? Book a designer consultation from the <a className="underline" href="/custom-request">custom request</a> page, or reach us below.</p>
      <div className="card mt-8 p-6 text-sm text-[#3A0F1B]/70">
        <p><strong>Rootage Group — Fringlale</strong></p>
        <p className="mt-2">Email: <a className="underline" href="mailto:pradipta@uuoinnovation.com">pradipta@uuoinnovation.com</a></p>
        <p className="mt-2 rounded bg-amber-100 p-3 text-amber-900">Add your registered address, phone and WhatsApp number in <code>app/contact/page.jsx</code>.</p>
      </div>
    </div></div>);
}
