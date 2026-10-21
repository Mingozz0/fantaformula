'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';

export function ToastProvider() {
  const params = useSearchParams();
  useEffect(() => {
    const url = new URL(window.location.href);
    const message = url.searchParams.get('message');
    const confirmationError = url.searchParams.get('error') === 'confirm';
    if (!message && !confirmationError) return;
    if (url.searchParams.get('outcome') === 'success') toast.success(message);
    else toast.error(message || 'Link di conferma non valido o scaduto. Richiedi una nuova email.');
    url.searchParams.delete('message');
    url.searchParams.delete('outcome');
    if (confirmationError) url.searchParams.delete('error');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [params]);
  return <Toaster position="top-center" richColors closeButton duration={5000} theme="light"
    containerAriaLabel="Messaggi" toastOptions={{ closeButtonAriaLabel: 'Chiudi messaggio' }}
    mobileOffset={{ top: 'max(16px, env(safe-area-inset-top))', left: 16, right: 16 }} />;
}
