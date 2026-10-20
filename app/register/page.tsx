'use client';

import Link from 'next/link';
import { Flag, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || !email || password.length < 6) {
      setError('Inserisci un nome di almeno 2 caratteri e una password di almeno 6.');
      return;
    }
    setLoading(true);
    const { data, error: authError } = await createClient().auth.signUp({
      email, password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) { setLoading(false); setError(authError.message); return; }
    if (!data.session) {
      setLoading(false);
      setNotice('Controlla la tua email e conferma l’account, poi accedi.');
      return;
    }
    router.replace('/home');
  }
  return <main className="grid min-h-screen place-items-center bg-[#0d0d0f] p-6 text-white">
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
      <Link href="/" className="flex items-center gap-2 font-black"><span className="grid h-9 w-9 place-items-center rounded-lg bg-red-600"><Flag size={18} /></span> GRID<span className="text-red-500">F1</span></Link>
      <div className="mt-10"><UserPlus className="text-red-500" /><h1 className="mt-4 text-3xl font-bold">Crea il tuo account</h1><p className="mt-2 text-zinc-400">Registrati per partecipare a una o più leghe.</p></div>
      <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
        <Field label="Nome completo" value={name} setValue={setName} placeholder="Mario Rossi" />
        <Field label="Email" value={email} setValue={setEmail} type="email" placeholder="nome@email.it" />
        <Field label="Password" value={password} setValue={setPassword} type="password" placeholder="Almeno 6 caratteri" />
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-red-600 py-3.5 font-bold hover:bg-red-500 disabled:opacity-60">{loading ? 'Registrazione in corso…' : 'Crea account'}</button>
      </form>
      <p className="mt-7 text-center text-sm text-zinc-400">Hai già un account? <Link href="/" className="font-bold text-red-400">Accedi</Link></p>
    </div>
  </main>;
}

function Field({ label, value, setValue, type = 'text', placeholder }: { label: string; value: string; setValue: (value: string) => void; type?: string; placeholder: string }) {
  return <label className="block text-sm font-medium text-zinc-300">{label}<input value={value} onChange={(event) => setValue(event.target.value)} type={type} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30" /></label>;
}
