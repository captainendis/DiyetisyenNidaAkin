// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Grup not defteri: "Yapılacak" (sonraki derslerin planı) ve "Derste yapıldı" (derste çalışılanlar).
 * Ekle, düzenle, yapıldı olarak işaretle, yapılacaklara geri al, sil.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, confirm, DateField, Icon, Loading, ErrorView, Section, Segmented, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatDayStr, relativeTime, todayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { classKeys, type ClassGroupNoteDTO } from './shared';

type NoteKind = ClassGroupNoteDTO['kind'];

function NoteItem({ n, canWrite, onChanged, last }: { n: ClassGroupNoteDTO; canWrite: boolean; onChanged: () => void; last?: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.body);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: 'Not silinsin mi?', confirmText: 'Sil', destructive: true }))) return;
    await run(() => api.del(`/classes/notes/${n.id}`), 'Not silindi');
  };
  const planned = n.kind === 'PLANNED';
  return (
    <View style={[styles.item, !last && styles.line]}>
      {planned && canWrite ? (
        <Pressable
          disabled={busy}
          onPress={() => void run(() => api.patch(`/classes/notes/${n.id}`, { kind: 'DONE', noteDate: todayStr() }), 'Yapıldı olarak işaretlendi')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel="Yapıldı olarak işaretle"
          hitSlop={10}
          style={styles.check}
        />
      ) : (
        <T variant="label" style={{ width: 52 }} color={colors.muted}>{formatDayStr(n.noteDate ?? n.createdAt.slice(0, 10), 'd MMM')}</T>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        {editing ? (
          <View style={{ gap: space.sm }}>
            <TextField value={text} onChange={setText} rows={3} maxLength={4000} accessibilityLabel="Notu düzenle" />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
              <Button title="Vazgeç" size="sm" variant="ghost" onPress={() => { setEditing(false); setText(n.body); }} />
              <Button title="Kaydet" size="sm" loading={busy} disabled={!text.trim()} onPress={() => void run(() => api.patch(`/classes/notes/${n.id}`, { body: text }), 'Not güncellendi')} />
            </View>
          </View>
        ) : (
          <T>{n.body}</T>
        )}
        <T variant="caption" accessibilityHint={formatDateTime(n.createdAt)}>
          {n.author ?? 'Silinmiş kullanıcı'} · {relativeTime(n.createdAt)}
        </T>
        {canWrite && !editing ? (
          <View style={styles.actions}>
            {!planned ? (
              <Pressable onPress={() => void run(() => api.patch(`/classes/notes/${n.id}`, { kind: 'PLANNED' }), 'Yapılacaklara taşındı')} accessibilityRole="button" accessibilityLabel="Yapılacaklara geri al" hitSlop={6} style={styles.act}>
                <Icon name="rotate-ccw" size={15} color={colors.muted} />
                <T variant="caption">Geri al</T>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Düzenle" hitSlop={6} style={styles.act}>
              <Icon name="edit-2" size={15} color={colors.muted} />
              <T variant="caption">Düzenle</T>
            </Pressable>
            <Pressable onPress={() => void remove()} accessibilityRole="button" accessibilityLabel="Sil" hitSlop={6} style={styles.act}>
              <Icon name="trash-2" size={15} color={colors.dangerInk} />
              <T variant="caption" color={colors.dangerInk}>Sil</T>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Composer({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<NoteKind>('DONE');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/classes/groups/${groupId}/notes`, { kind, body, noteDate: kind === 'DONE' ? date : null });
      setBody('');
      toast('Not eklendi');
      onAdded();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: space.md, marginBottom: space.xl }}>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'DONE', label: 'Derste yapıldı' },
          { value: 'PLANNED', label: 'Yapılacak' },
        ]}
      />
      {kind === 'DONE' ? <DateField label="Ders günü" value={date} onChange={setDate} maximumDate={todayStr()} /> : null}
      <TextField
        value={body}
        onChange={setBody}
        rows={3}
        maxLength={4000}
        accessibilityLabel="Not"
        placeholder={kind === 'DONE' ? 'Ör. Reformer footwork, 3 tur bridge; bir üye sol dizde hassasiyet söyledi.' : 'Ör. Gelecek hafta yan plank varyasyonlarına geç.'}
      />
      <Button title="Notu ekle" size="sm" icon="plus" loading={busy} disabled={!body.trim()} onPress={() => void save()} style={{ alignSelf: 'flex-end' }} />
    </Card>
  );
}

export function NoteBook({ groupId, canWrite }: { groupId: string; canWrite: boolean }) {
  const notes = useApiQuery(classKeys.notes(groupId), () => api.get<{ items: ClassGroupNoteDTO[] }>(`/classes/groups/${groupId}/notes`));
  const reload = () => void notes.refetch();
  const planned = notes.data?.items.filter((n) => n.kind === 'PLANNED') ?? [];
  const done = (notes.data?.items.filter((n) => n.kind === 'DONE') ?? []).sort((a, b) => (b.noteDate ?? b.createdAt).localeCompare(a.noteDate ?? a.createdAt));

  return (
    <>
      {canWrite ? <Composer groupId={groupId} onAdded={reload} /> : null}
      {notes.error ? (
        <ErrorView error={notes.error} onRetry={reload} />
      ) : notes.isPending ? (
        <Loading />
      ) : (
        <>
          <Section title={`Yapılacaklar${planned.length ? ` · ${planned.length}` : ''}`}>
            {planned.length ? (
              <Card padded={false}>
                {planned.map((n, i) => <NoteItem key={n.id} n={n} canWrite={canWrite} onChanged={reload} last={i === planned.length - 1} />)}
              </Card>
            ) : (
              <T muted>Sonraki dersler için not yok.</T>
            )}
          </Section>
          <Section title="Derslerde yapılanlar">
            {done.length ? (
              <Card padded={false}>
                {done.map((n, i) => <NoteItem key={n.id} n={n} canWrite={canWrite} onChanged={reload} last={i === done.length - 1} />)}
              </Card>
            ) : (
              <T muted>Henüz ders notu yok.</T>
            )}
          </Section>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  check: { width: 24, height: 24, marginTop: 1, borderRadius: radius.sm - 2, borderWidth: 1.5, borderColor: colors.taupe },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: 2 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
});
