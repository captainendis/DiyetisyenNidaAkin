// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /hesabim/pilates — grup(lar), yaklaşan ve geçmiş dersler, katılım özeti, ders talebi.
 * Diğer katılımcıların bilgisi gösterilmez. Talep Randevular'a saatsiz yeni talep olarak düşer.
 */
import { useEffect, useState } from 'react';
import { ApiError, portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatTime } from '@/lib/format';
import {
  DAYPARTS, DAYPART_HOURS, DAYPART_LABEL, PILATES_FORMAT_LABEL, WEEKDAY_LABEL, pilatesPreferenceText,
  type Daypart, type PilatesFormat,
} from '@shared/constants';
import type { PortalPilates } from '@shared/portal';
import { ClassRow } from '@/components/portal/ClassRow';
import { Empty, LoadError, Loading, Panel, PanelTitle, PortalButton, PortalPageHeader } from '@/components/portal/ui';
import { cn } from '@/lib/text';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const patternText = (p: { weekday: number; time: string }[]) => p.map((x) => `${WEEKDAY_LABEL[x.weekday]} ${x.time}`).join(', ');

function RequestForm({ onSent }: { onSent: () => void }) {
  const [format, setFormat] = useState<PilatesFormat | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [parts, setParts] = useState<Daypart[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    if (!format) return setError('Grup dersi mi birebir ders mi istediğini seç.');
    setBusy(true);
    setError(null);
    try {
      const r = await portalApi.post<{ reference: string }>('/pilates/requests', { pilatesFormat: format, preferredDays: days, preferredDayparts: parts, message: message || null });
      setSent(r.reference);
      setFormat(null);
      setDays([]);
      setParts([]);
      setMessage('');
      onSent();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Talebin gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => cn('rounded-full px-4 py-2 text-[0.9rem] ring-1 ring-inset transition-colors', on ? 'bg-espresso text-ivory ring-espresso' : 'bg-white text-espresso ring-espresso/15 hover:ring-espresso/40');

  if (sent) {
    return (
      <div>
        <p className="text-[1rem] leading-relaxed text-cocoa">Talebin alındı (referans <span className="font-semibold tracking-wide">{sent}</span>). Ders saati belirlenince seninle iletişime geçilecek.</p>
        <button type="button" onClick={() => setSent(null)} className="mt-4 text-[0.92rem] font-semibold text-espresso underline underline-offset-4">Yeni talep oluştur</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[0.92rem] font-semibold text-taupe">Ders türü</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['GROUP', 'PRIVATE'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={format === f} onClick={() => { setFormat(f); setError(null); }} className={cn('rounded-lg px-4 py-3 text-left ring-1 ring-inset transition-colors', format === f ? 'bg-espresso text-ivory ring-espresso' : 'bg-white ring-espresso/15 hover:ring-espresso/40')}>
              <span className="block font-semibold">{PILATES_FORMAT_LABEL[f]}</span>
              <span className={cn('block text-[0.85rem]', format === f ? 'text-ivory/75' : 'text-taupe')}>{f === 'GROUP' ? 'Bir gruba katılmak ya da grubunu değiştirmek için' : 'Ek ya da telafi için birebir ders'}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[0.92rem] font-semibold text-taupe">Sana uyan günler <span className="font-normal">(boş bırakırsan fark etmez)</span></legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((l) => toggle(l, d))} className={chip(days.includes(d))}>{WEEKDAY_LABEL[d]}</button>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[0.92rem] font-semibold text-taupe">Gün içinde</legend>
        <div className="flex flex-wrap gap-2">
          {DAYPARTS.map((p) => (
            <button key={p} type="button" aria-pressed={parts.includes(p)} onClick={() => setParts((l) => toggle(l, p))} className={chip(parts.includes(p))}>
              {DAYPART_LABEL[p]} <span className="tabular-nums opacity-70">{DAYPART_HOURS[p]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="pl-msg" className="mb-2 block text-[0.92rem] font-semibold text-taupe">Not <span className="font-normal">(isteğe bağlı)</span></label>
        <textarea id="pl-msg" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ör. salı dersine gelemeyeceğim, telafi istiyorum." className="w-full rounded-lg border-0 bg-white px-4 py-3 text-[0.98rem] ring-1 ring-espresso/15 ring-inset focus:ring-2 focus:ring-espresso focus:outline-none" />
      </div>
      {error && <p className="text-[0.9rem] text-danger-ink" role="alert">{error}</p>}
      <PortalButton onClick={() => void submit()} disabled={busy}>{busy ? 'Gönderiliyor…' : 'Talebi gönder'}</PortalButton>
    </div>
  );
}

export default function PortalPilatesPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<PortalPilates>('/pilates'), []);
  useEffect(() => {
    document.title = 'Pilates | Nida Akın';
  }, []);

  const next = data?.upcoming[0] ?? null;
  return (
    <>
      <PortalPageHeader title="Pilates" lead="Derslerin, katılımın ve ders taleplerin. Gelemeyeceğin bir ders olursa önceden haber ver; yerin telafi için açılabilsin." />
      {loading && !data ? (
        <Loading rows={4} />
      ) : error || !data ? (
        <LoadError message={error?.message} onRetry={reload} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-10">
            {next ? (
              <Panel className="sm:p-7">
                <PanelTitle>Sıradaki dersin</PanelTitle>
                <p className="font-display nums text-[2rem] leading-tight">{formatDate(next.startsAt)}</p>
                <p className="mt-1 text-[1.05rem] font-semibold tabular-nums">{formatTime(next.startsAt)}–{formatTime(next.endsAt)}</p>
                <p className="mt-2 text-[0.95rem] text-taupe">{next.title}</p>
              </Panel>
            ) : (
              <Empty title="Planlanmış dersin yok.">Bir gruba katılmak ya da birebir ders almak için yandaki formdan talep gönderebilirsin.</Empty>
            )}

            {data.upcoming.length > 1 && (
              <section aria-labelledby="yaklasan">
                <h2 id="yaklasan" className="mb-3 text-[0.92rem] font-semibold text-taupe">Yaklaşan dersler</h2>
                <ul className="space-y-3">{data.upcoming.slice(1).map((s) => <ClassRow key={s.id} s={s} />)}</ul>
              </section>
            )}

            {data.past.length > 0 && (
              <section aria-labelledby="gecmis">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="gecmis" className="text-[0.92rem] font-semibold text-taupe">Geçmiş dersler</h2>
                  <p className="text-[0.88rem] text-taupe tabular-nums">
                    {data.stats.attended} katıldın{data.stats.excused ? ` · ${data.stats.excused} haber verdin` : ''}{data.stats.noShow ? ` · ${data.stats.noShow} gelmedin` : ''}
                  </p>
                </div>
                <ul className="space-y-3">{data.past.map((s) => <ClassRow key={s.id} s={s} />)}</ul>
              </section>
            )}
          </div>

          <div className="space-y-6">
            {data.groups.length > 0 && (
              <Panel>
                <PanelTitle>{data.groups.length > 1 ? 'Grupların' : 'Grubun'}</PanelTitle>
                <ul className="space-y-3">
                  {data.groups.map((g) => (
                    <li key={g.id}>
                      <p className="font-display text-[1.35rem] leading-tight">{g.name}</p>
                      <p className="mt-0.5 text-[0.9rem] text-taupe">{g.pattern.length ? patternText(g.pattern) : 'Ders saatleri yakında planlanacak'} · {g.durationMinutes} dk</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {data.requests.length > 0 && (
              <Panel>
                <PanelTitle>Yanıt bekleyen taleplerin</PanelTitle>
                <ul className="space-y-3">
                  {data.requests.map((r) => (
                    <li key={r.id} className="text-[0.95rem]">
                      <p className="font-semibold">{r.pilatesFormat ? PILATES_FORMAT_LABEL[r.pilatesFormat] : 'Pilates'}</p>
                      <p className="text-[0.88rem] text-taupe">{pilatesPreferenceText(r.preferredDays, r.preferredDayparts)} · {formatDate(r.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel>
              <PanelTitle>Ders talep et</PanelTitle>
              <RequestForm onSent={reload} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
