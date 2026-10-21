'use client';

import Link from 'next/link';
import { ArrowRight, Flag, Trophy, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      toast.error('Inserisci email e password per proseguire.');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      if (authError) { toast.error('Accesso non riuscito. Controlla email, password e conferma dell’account.'); return; }
      toast.success('Accesso effettuato.');
      router.replace('/home');
    } catch { toast.error('Connessione non disponibile. Riprova tra poco.'); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-svh bg-[#0d0d0f] text-white">
      <div className="mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#8f111a,transparent_35%),linear-gradient(135deg,#151519,#09090b)] p-8 lg:flex lg:p-14">
          <Link href="/" className="flex items-center gap-3 text-lg font-black tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-600"><Flag size={21} /></span>
            GRID<span className="text-red-500">F1</span>
          </Link>
          <div className="max-w-xl py-16">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-red-400">Fanta Formula 1</p>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">La tua griglia.<br />La tua stagione.</h1>
            <p className="mt-7 max-w-md text-lg leading-8 text-zinc-300">Crea una lega con gli amici, scegli i tuoi piloti e schiera la formazione prima di ogni Gran Premio.</p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-3 text-sm text-zinc-200">
            <Stat icon={<Users size={18} />} value="4–7" label="partecipanti" />
            <Stat icon={<Trophy size={18} />} value="3" label="piloti" />
            <Stat icon={<Flag size={18} />} value="1" label="scuderia" />
          </div>
        </section>
        <section className="flex items-center justify-center bg-zinc-950 px-5 py-8 sm:p-10 lg:p-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-black lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-red-600"><Flag className="size-5" /></span>GRID<span className="text-red-500">F1</span></Link>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">Bentornato</p>
            <h2 className="mt-3 text-3xl font-bold">Accedi alla tua lega</h2>
            <p className="mt-2 text-zinc-400">Accedi con il tuo account GRIDF1.</p>
            <form className="mt-9 space-y-5" onSubmit={submit} noValidate>
              <label className="block text-sm font-medium text-zinc-300">Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30" placeholder="nome@email.it" />
              </label>
              <label className="block text-sm font-medium text-zinc-300">Password
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30" placeholder="••••••••" />
              </label>
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold transition hover:bg-red-500 disabled:opacity-60">{loading ? 'Accesso in corso…' : 'Entra nella griglia'} <ArrowRight size={18} /></button>
            </form>
            <p className="mt-7 text-center text-sm text-zinc-400">Non hai un account? <Link className="font-bold text-red-400 hover:text-red-300" href="/register">Registrati</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="mb-5 text-red-400">{icon}</div><p className="text-xl font-black">{value}</p><p className="text-xs text-zinc-400">{label}</p></div>;
}
