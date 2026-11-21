// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Pilates ders talebi (web: PortalPilatesPage → RequestForm). Talep, Randevular'a saatsiz yeni talep olarak düşer.
 * POST /api/portal/pilates/requests { pilatesFormat, preferredDays, preferredDayparts, message }
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DAYPARTS, DAYPART_HOURS, DAYPART_LABEL, PILATES_FORMATS, PILATES_FORMAT_LABEL, WEEKDAY_LABEL, type Daypart, type PilatesFormat } from '@shared/constants';
import { Button, Chips, Icon, Notice, Sheet, T, TextField } from '@/components/ui';
import { portalApi } from '@/lib/api';
import { useApiMutation } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { PK } from './util';

const FORMAT_HINT: Record<PilatesFormat, string> = {
  GROUP: 'Bir gruba katılmak ya da grubunu değiştirmek için',
  PRIVATE: 'Ek ya da telafi için birebir ders',
};

export function PilatesRequestSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [format, setFormat] = useState<PilatesFormat | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [parts, setParts] = useState<Daypart[]>([]);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const m = useApiMutation(
    (body: { pilatesFormat: PilatesFormat; preferredDays: number[]; preferredDayparts: Daypart[]; message: string | null }) =>
      portalApi.post<{ reference: string }>('/pilates/requests', body),
    {
      invalidate: [PK.pilates, PK.requests, PK.overview],
      onSuccess: (r) => {
        setSent(r.reference);
        setFormat(null);
        setDays([]);
        setParts([]);
        setMessage('');
      },
    },
  );

  const submit = () => {
    if (!format) return setLocalError('Grup dersi mi birebir ders mi istediğini seç.');
    setLocalError(null);
    m.mutate({ pilatesFormat: format, preferredDays: days, preferredDayparts: parts, message: message.trim() || null });
  };

  const close = () => {
    setSent(null);
    setLocalError(null);
    m.reset();
    onClose();
  };

  const error = localError ?? (m.error ? m.fieldErrors.pilatesFormat ?? m.error.message : null);

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Ders talep et"
      subtitle={sent ? undefined : 'Ders saati belirlenince seninle iletişime geçilir.'}
      full={!sent}
      footer={
        sent ? (
          <>
            <Button title="Yeni talep oluştur" variant="secondary" onPress={() => setSent(null)} style={{ flex: 1 }} />
            <Button title="Tamam" onPress={close} style={{ flex: 1 }} />
          </>
        ) : (
          <Button title={m.isPending ? 'Gönderiliyor…' : 'Talebi gönder'} loading={m.isPending} onPress={submit} style={{ flex: 1 }} />
        )
      }
    >
      {sent ? (
        <Notice
          tone="success"
          title="Talebin alındı"
          text={`Referans: ${sent}. Ders saati belirlenince seninle iletişime geçilecek.`}
        />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <T variant="label">Ders türü</T>
            {PILATES_FORMATS.map((f) => {
              const sel = format === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    setFormat(f);
                    setLocalError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  style={[styles.format, sel && styles.formatSel]}
                >
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: fonts.semibold, color: sel ? colors.ivory : colors.text }}>{PILATES_FORMAT_LABEL[f]}</T>
                    <T variant="caption" color={sel ? colors.mist : colors.muted}>{FORMAT_HINT[f]}</T>
                  </View>
                  {sel ? <Icon name="check" size={18} color={colors.cream} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Chips
            label="Sana uyan günler (boş bırakırsan fark etmez)"
            multiple
            value={days}
            options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: WEEKDAY_LABEL[d]! }))}
            onChange={(v) => setDays(v as number[])}
          />
          <Chips
            label="Gün içinde"
            multiple
            value={parts}
            options={DAYPARTS.map((p) => ({ value: p, label: `${DAYPART_LABEL[p]} ${DAYPART_HOURS[p]}` }))}
            onChange={(v) => setParts(v as Daypart[])}
          />
          <TextField
            label="Not (isteğe bağlı)"
            value={message}
            onChange={setMessage}
            rows={3}
            maxLength={1000}
            placeholder="Ör. salı dersine gelemeyeceğim, telafi istiyorum."
            error={m.fieldErrors.message}
          />
          {error ? <Notice tone="danger" text={error} /> : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  format: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  formatSel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
});
