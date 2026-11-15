// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /panel/pilates — pilates grupları ve grup not defteri
 *  - Solda gruplar (aktif / pasif), sağda seçili grubun üyeleri ve not defteri
 *  - Not defteri: "Yapılacak" (sonraki derslerin planı) ve "Yapıldı" (derste çalışılanlar)
 *  - Ders saatleri ve yoklama bu sayfada değil, Randevular sayfasında yönetilir
 * URL parametresi: grup (seçili grup)
 */
import { useCallback, useState } from 'react';
import { CalendarDays, Check, MoreHorizontal, Pencil, Plus, Power, RotateCcw, Trash2, Users } from 'lucide-react';
import { Link, useSearchParams } from '@/lib/router';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDateTime, formatDayStr, relativeTime, todayStr } from '@/lib/format';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Textarea, useFeedback } from '@/components/panel/ui';
import { GroupFormModal } from '@/components/panel/classes/GroupFormModal';
import { SeatDots, clientName, patternLabel, type ClassGroupDTO } from '@/components/panel/classes/shared';
import type { ClassGroupNoteDTO } from '@shared/classes';

type NoteKind = ClassGroupNoteDTO['kind'];

// ───────────────────────── Grup listesi ─────────────────────────

function GroupList({ groups, selectedId, onSelect }: { groups: ClassGroupDTO[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const active = groups.filter((g) => g.isActive);
  const passive = groups.filter((g) => !g.isActive);
  const item = (g: ClassGroupDTO) => (
    <li key={g.id}>
      <button
        type="button"
        onClick={() => onSelect(g.id)}
        aria-current={selectedId === g.id ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          selectedId === g.id ? 'bg-cocoa text-ivory' : 'hover:bg-panel-bg',
          !g.isActive && selectedId !== g.id && 'text-panel-muted',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{g.name}</span>
          <span className={cn('block truncate text-[0.78rem]', selectedId === g.id ? 'text-ivory/75' : 'text-panel-muted')}>
            {g.pattern.length ? patternLabel(g.pattern) : 'Planlı ders yok'}
          </span>
        </span>
        <SeatDots taken={g.members.length} capacity={g.capacity} className={selectedId === g.id ? 'opacity-80' : undefined} />
      </button>
    </li>
  );
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-panel-line">{active.map(item)}</ul>
      {!active.length && <p className="px-4 py-3 text-sm text-panel-muted">Aktif grup yok.</p>}
      {passive.length > 0 && (
        <>
          <p className="border-t border-panel-line bg-panel-bg/60 px-4 py-2 text-[0.75rem] font-semibold text-panel-muted">Pasif gruplar</p>
          <ul className="divide-y divide-panel-line">{passive.map(item)}</ul>
        </>
      )}
    </Card>
  );
}

// ───────────────────────── Not defteri ─────────────────────────

function NoteItem({ n, canWrite, onChanged }: { n: ClassGroupNoteDTO; canWrite: boolean; onChanged: () => void }) {
  const fb = useFeedback();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.body);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) fb.success(ok);
      setEditing(false);
      onChanged();
    } catch (e) {
      fb.error('İşlem yapılamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await fb.confirm({ title: 'Not silinsin mi?', confirmLabel: 'Sil', tone: 'danger' }))) return;
    await run(() => api.del(`/classes/notes/${n.id}`), 'Not silindi');
  };
  const planned = n.kind === 'PLANNED';
  return (
    <li className="group flex gap-3 py-3">
      {planned && canWrite ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.patch(`/classes/notes/${n.id}`, { kind: 'DONE', noteDate: todayStr() }), 'Yapıldı olarak işaretlendi')}
          aria-label="Yapıldı olarak işaretle"
          title="Yapıldı olarak işaretle"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cocoa/40 text-transparent hover:border-cocoa hover:text-cocoa"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="tabular mt-0.5 w-14 shrink-0 text-[0.78rem] font-semibold text-panel-muted">
          {formatDayStr(n.noteDate ?? n.createdAt.slice(0, 10), 'd MMM')}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} aria-label="Notu düzenle" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(n.body); }}>Vazgeç</Button>
              <Button size="sm" loading={busy} disabled={!text.trim()} onClick={() => void run(() => api.patch(`/classes/notes/${n.id}`, { body: text }), 'Not güncellendi')}>Kaydet</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line text-espresso">{n.body}</p>
        )}
        <p className="mt-1 text-[0.75rem] text-panel-muted">
          {n.author ?? 'Silinmiş kullanıcı'} · <span title={formatDateTime(n.createdAt)}>{relativeTime(n.createdAt)}</span>
        </p>
      </div>
      {canWrite && !editing && (
        <div className="flex shrink-0 items-start gap-0.5 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {!planned && (
            <button type="button" onClick={() => void run(() => api.patch(`/classes/notes/${n.id}`, { kind: 'PLANNED' }), 'Yapılacaklara taşındı')} aria-label="Yapılacaklara geri al" title="Yapılacaklara geri al" className="rounded-md p-1.5 text-panel-muted hover:bg-panel-bg hover:text-espresso">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setEditing(true)} aria-label="Düzenle" className="rounded-md p-1.5 text-panel-muted hover:bg-panel-bg hover:text-espresso">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => void remove()} aria-label="Sil" className="rounded-md p-1.5 text-panel-muted hover:bg-danger/10 hover:text-danger-ink">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function NoteComposer({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const fb = useFeedback();
  const [kind, setKind] = useState<NoteKind>('DONE');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/classes/groups/${groupId}/notes`, { kind, body, noteDate: kind === 'DONE' ? date : null });
      setBody('');
      onAdded();
    } catch (e) {
      fb.error('Not eklenemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl bg-panel-bg/70 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Not türü" className="inline-flex rounded-lg bg-white p-1 ring-1 ring-panel-line">
          {(['DONE', 'PLANNED'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-md px-3 py-1.5 text-[0.82rem] font-semibold transition-colors', kind === k ? 'bg-cocoa text-ivory' : 'text-panel-muted hover:text-cocoa')}
            >
              {k === 'DONE' ? 'Derste yapıldı' : 'Yapılacak'}
            </button>
          ))}
        </div>
        {kind === 'DONE' && (
          <label className="flex items-center gap-2 text-[0.8rem] text-panel-muted">
            Ders günü
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="tabular h-8 rounded-lg border border-panel-line bg-white px-2 text-sm text-espresso" />
          </label>
        )}
      </div>
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        aria-label="Not"
        placeholder={kind === 'DONE' ? 'Ör. Reformer footwork, 3 tur bridge; bir üye sol dizde hassasiyet söyledi.' : 'Ör. Gelecek hafta yan plank varyasyonlarına geç.'}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" loading={busy} disabled={!body.trim()} onClick={() => void save()}>Notu ekle</Button>
      </div>
    </div>
  );
}

function GroupDetail({ g, onEdit, onChanged }: { g: ClassGroupDTO; onEdit: () => void; onChanged: () => void }) {
  const fb = useFeedback();
  const { can } = usePanelAuth();
  const canWrite = can('appointments:write');
  const [menu, setMenu] = useState(false);
  const notes = useApi(() => api.get<{ items: ClassGroupNoteDTO[] }>(`/classes/groups/${g.id}/notes`), [g.id]);
  const planned = notes.data?.items.filter((n) => n.kind === 'PLANNED') ?? [];
  const done = (notes.data?.items.filter((n) => n.kind === 'DONE') ?? []).sort((a, b) => (b.noteDate ?? b.createdAt).localeCompare(a.noteDate ?? a.createdAt));

  const toggle = async () => {
    try {
      await api.patch(`/classes/groups/${g.id}`, { isActive: !g.isActive });
      fb.success(g.isActive ? 'Grup pasife alındı' : 'Grup aktifleştirildi', g.isActive && g.upcomingCount ? `${g.upcomingCount} planlı ders takvimde kalır; gerekirse Randevular sayfasından iptal edin.` : undefined);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) fb.error('Grup güncellenemedi', e.message);
    }
  };
  const remove = async () => {
    const ok = await fb.confirm({ title: `“${g.name}” silinsin mi?`, description: 'Geçmiş dersler ve katılım kayıtları korunur; grup, üyelik listesi ve grubun not defteri silinir.', confirmLabel: 'Grubu sil', tone: 'danger' });
    if (!ok) return;
    try {
      await api.del(`/classes/groups/${g.id}`);
      fb.success('Grup silindi');
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) fb.error('Grup silinemedi', e.message);
    }
  };

  return (
    <Card as="article" className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-panel-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.15rem] font-bold text-espresso">
            {g.name} {!g.isActive && <Badge tone="neutral">Pasif</Badge>}
          </h2>
          <p className="mt-0.5 text-[0.82rem] text-panel-muted">
            {g.pattern.length ? patternLabel(g.pattern) : 'Planlı ders yok'} · {g.defaultDurationMinutes} dk · {g.members.length}/{g.capacity} kişi
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>Düzenle</Button>
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Grup işlemleri" aria-expanded={menu} className="rounded-lg p-1.5 text-panel-muted hover:bg-panel-bg hover:text-espresso">
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} aria-hidden />
                  <div role="menu" className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-xl border border-panel-line bg-white py-1.5 shadow-[0_18px_40px_-16px_rgba(33,23,16,0.35)]">
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); void toggle(); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-cocoa hover:bg-panel-bg">
                      <Power className="h-4 w-4" /> {g.isActive ? 'Pasife al' : 'Aktifleştir'}
                    </button>
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); void remove(); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-danger-ink hover:bg-danger/10">
                      <Trash2 className="h-4 w-4" /> Grubu sil
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-6">
          {canWrite && <NoteComposer groupId={g.id} onAdded={notes.reload} />}
          {notes.error ? (
            <ErrorState message={notes.error.message} onRetry={notes.reload} />
          ) : notes.loading && !notes.data ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <>
              <section aria-labelledby="planned-h">
                <h3 id="planned-h" className="text-[0.95rem] font-bold text-espresso">
                  Yapılacaklar {planned.length > 0 && <span className="tabular font-normal text-panel-muted">{planned.length}</span>}
                </h3>
                {planned.length ? (
                  <ul className="divide-y divide-panel-line">{planned.map((n) => <NoteItem key={n.id} n={n} canWrite={canWrite} onChanged={notes.reload} />)}</ul>
                ) : (
                  <p className="mt-2 text-sm text-panel-muted">Sonraki dersler için not yok.</p>
                )}
              </section>
              <section aria-labelledby="done-h">
                <h3 id="done-h" className="text-[0.95rem] font-bold text-espresso">Derslerde yapılanlar</h3>
                {done.length ? (
                  <ul className="divide-y divide-panel-line">{done.map((n) => <NoteItem key={n.id} n={n} canWrite={canWrite} onChanged={notes.reload} />)}</ul>
                ) : (
                  <p className="mt-2 text-sm text-panel-muted">Henüz ders notu yok.</p>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="space-y-5 xl:border-l xl:border-panel-line xl:pl-6">
          <section>
            <h3 className="mb-2 text-[0.8rem] font-semibold text-panel-muted">Üyeler</h3>
            {g.members.length ? (
              <ul className="space-y-1.5">
                {g.members.map((m) => (
                  <li key={m.id}><Link to={`/panel/danisanlar/${m.id}?sekme=pilates`} className="text-sm font-medium text-espresso hover:underline">{clientName(m)}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-panel-muted">Üye eklenmedi.</p>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-[0.8rem] font-semibold text-panel-muted">Dersler</h3>
            <p className="text-sm text-espresso">
              {g.nextSession ? <>Sonraki: <span className="tabular font-semibold">{formatDateTime(g.nextSession.startsAt)}</span><span className="text-panel-muted"> · {g.upcomingCount} planlı</span></> : 'Planlı ders yok.'}
            </p>
            <Link
              to={`/panel/randevular?view=week${g.nextSession ? `&d=${g.nextSession.startsAt.slice(0, 10)}` : ''}`}
              className="mt-2 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-cocoa underline decoration-panel-line underline-offset-4 hover:decoration-cocoa"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Ders saatleri Randevular’da
            </Link>
          </section>
          {g.note && (
            <section>
              <h3 className="mb-1 text-[0.8rem] font-semibold text-panel-muted">Grup açıklaması</h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-espresso">{g.note}</p>
            </section>
          )}
        </aside>
      </div>
    </Card>
  );
}

// ───────────────────────── Sayfa ─────────────────────────

function Inner() {
  const [params, setParams] = useSearchParams();
  const { can } = usePanelAuth();
  const canWrite = can('appointments:write');
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: ClassGroupDTO | null }>({ open: false, group: null });
  const groups = useApi(() => api.get<{ items: ClassGroupDTO[] }>('/classes/groups'), [refreshKey]);
  const bump = () => setRefreshKey((k) => k + 1);

  const select = useCallback(
    (id: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set('grup', id);
          else next.delete('grup');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const items = groups.data?.items ?? [];
  const wanted = params.get('grup');
  const selected = items.find((g) => g.id === wanted) ?? items.find((g) => g.isActive) ?? items[0] ?? null;

  return (
    <>
      <PageHeader
        title="Pilates grupları"
        description="Grupları ve üyeleri yönetin; derslerde yapılanları ve sonraki derslerin planını not alın. Ders saatleri ve yoklama Randevular sayfasındadır."
        actions={canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGroupModal({ open: true, group: null })}>Yeni grup</Button>}
      />

      {groups.error ? (
        <Card><ErrorState message={groups.error.message} onRetry={bump} /></Card>
      ) : groups.loading && !groups.data ? (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Henüz pilates grubu yok."
            description="Sabit saatte birlikte ders alan danışanları bir grupta toplayın. Ders saatlerini Randevular sayfasından gruba ekleyebilirsiniz."
            action={canWrite && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGroupModal({ open: true, group: null })}>İlk grubu oluştur</Button>}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <GroupList groups={items} selectedId={selected?.id ?? null} onSelect={select} />
          {selected && <GroupDetail key={selected.id} g={selected} onEdit={() => setGroupModal({ open: true, group: selected })} onChanged={bump} />}
        </div>
      )}

      <GroupFormModal
        open={groupModal.open}
        group={groupModal.group}
        onClose={() => setGroupModal({ open: false, group: null })}
        onSaved={(g) => {
          setGroupModal({ open: false, group: null });
          bump();
          select(g.id);
        }}
      />
    </>
  );
}

export default function ClassesPage() {
  return (
    <RequirePermission perm="appointments:read">
      <Inner />
    </RequirePermission>
  );
}
