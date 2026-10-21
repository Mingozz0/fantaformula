'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Flag, Gauge, House, LogOut, Settings2, Trophy, Users, X } from 'lucide-react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarSeparator, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NavigationLink, SubmitButton } from './action-feedback';
import { leagueStatusLabel } from '@/lib/labels';
import { signOut } from '@/app/home/actions';

export type PortalLeague = { id: string; name: string; status: string };
type ShellProps = { children: ReactNode; name: string; leagues: PortalLeague[];
  selectedLeagueId?: string; activeTab: string; isAdmin: boolean; isManager: boolean; defaultOpen?: boolean };

const sections = [
  { id: 'overview', label: 'Panoramica', icon: House },
  { id: 'team', label: 'La mia squadra', icon: Users },
  { id: 'lineup', label: 'Formazione', icon: ClipboardList },
  { id: 'standings', label: 'Classifica', icon: Trophy },
  { id: 'results', label: 'Risultati', icon: Flag },
];

function PortalSidebar({ name, leagues, selectedLeagueId, activeTab, isAdmin, isManager }: Omit<ShellProps, 'children' | 'defaultOpen'>) {
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  const [switching, startTransition] = useTransition();
  const selected = leagues.find((league) => league.id === selectedLeagueId);
  const href = (tab: string) => selectedLeagueId ? `/home?${new URLSearchParams({ league: selectedLeagueId, tab })}` : '/home';
  const closeMenu = () => setOpenMobile(false);
  return <Sidebar collapsible="offcanvas" className="border-sidebar-border">
    <SidebarHeader className="gap-6 px-5 pb-5 pt-6">
      <div className="flex items-center justify-between">
        <NavigationLink href={href('overview')} onClick={closeMenu} className="text-xl font-black tracking-tight text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-red-600"><Flag className="size-4.5" /></span>
          <span>GRID<span className="text-red-500">F1</span></span>
        </NavigationLink>
        <button type="button" onClick={closeMenu} className="grid size-10 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white md:hidden" aria-label="Chiudi menu"><X className="size-5" /></button>
      </div>
      {selected && <div className="space-y-2">
        <label htmlFor="portal-league" className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">La tua lega</label>
        {leagues.length > 1 ? <Select value={selected.id} disabled={switching} onValueChange={(league) => {
          closeMenu(); startTransition(() => router.push(`/home?${new URLSearchParams({ league, tab: 'overview' })}`));
        }}>
          <SelectTrigger id="portal-league" className="h-11! w-full rounded-xl border-zinc-700 bg-zinc-900 text-white"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">{leagues.map((league) => <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>)}</SelectContent>
        </Select> : <p id="portal-league" className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-bold text-white">{selected.name}</p>}
        <p className="flex items-center gap-2 text-xs text-zinc-400"><span className={`size-1.5 rounded-full ${selected.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />{leagueStatusLabel(selected.status)}</p>
      </div>}
    </SidebarHeader>
    <SidebarSeparator />
    <SidebarContent role="navigation" aria-label="Menu principale" className="px-3 py-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="px-3 text-[11px] uppercase tracking-widest text-zinc-500">La stagione</SidebarGroupLabel>
        <SidebarGroupContent><SidebarMenu className="gap-1">
          {sections.filter((section) => selected || section.id === 'overview').map(({ id, label, icon: Icon }) => <SidebarMenuItem key={id}>
            <SidebarMenuButton asChild isActive={activeTab === id} className="h-11! rounded-xl px-3 font-medium data-[active=true]:bg-red-600 data-[active=true]:text-white">
              <NavigationLink href={href(id)} onClick={closeMenu} aria-current={activeTab === id ? 'page' : undefined}><Icon className="size-4" /><span>{label}</span></NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>)}
        </SidebarMenu></SidebarGroupContent>
      </SidebarGroup>
      {(isAdmin || isManager) && <SidebarGroup className="mt-5 p-0">
        <SidebarGroupLabel className="px-3 text-[11px] uppercase tracking-widest text-zinc-500">Amministrazione</SidebarGroupLabel>
        <SidebarGroupContent><SidebarMenu className="gap-1">
          {isAdmin && selected && <SidebarMenuItem><SidebarMenuButton asChild isActive={activeTab === 'manage'} className="h-11! rounded-xl px-3 font-medium data-[active=true]:bg-red-600 data-[active=true]:text-white">
            <NavigationLink href={href('manage')} onClick={closeMenu} aria-current={activeTab === 'manage' ? 'page' : undefined}><Settings2 className="size-4" /><span>Gestione squadre</span></NavigationLink>
          </SidebarMenuButton></SidebarMenuItem>}
          {isManager && <SidebarMenuItem><SidebarMenuButton asChild isActive={activeTab === 'manager'} className="h-11! rounded-xl px-3 font-medium data-[active=true]:bg-red-600 data-[active=true]:text-white">
            <NavigationLink href={selectedLeagueId ? `/manager?league=${selectedLeagueId}` : '/manager'} onClick={closeMenu} aria-current={activeTab === 'manager' ? 'page' : undefined}><Gauge className="size-4" /><span>Gestisci risultati</span></NavigationLink>
          </SidebarMenuButton></SidebarMenuItem>}
        </SidebarMenu></SidebarGroupContent>
      </SidebarGroup>}
    </SidebarContent>
    <SidebarFooter className="gap-3 border-t border-zinc-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{name}</p><p className="mt-1 text-xs text-zinc-500">{isAdmin ? 'Amministratore di lega' : 'Partecipante'}</p></div>
      <form action={signOut}><SubmitButton pendingLabel="Uscita…" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"><LogOut className="size-4" />Esci dal portale</SubmitButton></form>
    </SidebarFooter>
  </Sidebar>;
}

export function PortalShell({ children, defaultOpen = true, ...props }: ShellProps) {
  const title = sections.find((section) => section.id === props.activeTab)?.label
    ?? (props.activeTab === 'manager' ? 'Gestisci risultati' : 'Gestione squadre');
  const initials = props.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
  return <SidebarProvider defaultOpen={defaultOpen} className="min-h-svh bg-[#f6f6f4] text-zinc-950">
    <a href="#contenuto" className="sr-only z-[100] rounded-lg bg-white p-3 text-sm font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Vai al contenuto</a>
    <PortalSidebar {...props} />
    <SidebarInset className="min-w-0 bg-transparent">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-[#f6f6f4]/95 px-3 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="size-11 rounded-xl" aria-label="Apri o chiudi il menu" /><span aria-hidden="true" className="h-5 w-px bg-zinc-200" /><p className="truncate text-sm font-semibold">{title}</p></div>
        <div className="flex min-w-0 items-center gap-3"><span className="hidden max-w-48 truncate text-sm text-zinc-600 sm:block">{props.name}</span><span aria-label={`Account di ${props.name}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-xs font-bold">{initials}</span></div>
      </header>
      <div id="contenuto" className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">{children}</div>
    </SidebarInset>
  </SidebarProvider>;
}
