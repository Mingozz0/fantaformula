'use client';

import NextLink, { useLinkStatus } from 'next/link';
import { useFormStatus } from 'react-dom';
import type { ComponentProps, ReactNode } from 'react';

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

export function SubmitButton({ children, disabled, className = '', pendingLabel = 'Salvataggio…', ...props }:
  ComponentProps<'button'> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}
    className={`${className} ${pending ? 'cursor-wait' : 'disabled:cursor-not-allowed'} disabled:opacity-60`}>
    {pending ? <span role="status" className="inline-flex items-center justify-center gap-2"><Spinner />{pendingLabel}</span> : children}
  </button>;
}

function LinkContent({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return <span aria-busy={pending} className="inline-flex items-center gap-2">
    {children}
    {pending && <span role="status" aria-label="Apertura della pagina" className="inline-flex"><Spinner /></span>}
  </span>;
}

export function NavigationLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}><LinkContent>{children}</LinkContent></NextLink>;
}
