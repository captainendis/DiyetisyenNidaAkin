// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Birden çok danışan seçimi (arama + çipler), en fazla `max` kişi — web'deki MultiClientPicker karşılığı */
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon, T, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { clientName, useDebounced, type ClassClientRef } from './shared';

export function ClientPicker({
  value,
  onChange,
  max,
  label = 'Üyeler',
  hint,
  error,
  exclude = [],
  hideCount = false,
  disabled,
}: {
  value: ClassClientRef[];
  onChange: (v: ClassClientRef[]) => void;
  max: number;
  label?: string;
  hint?: string;
  error?: string;
  exclude?: string[];
  hideCount?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const full = value.length >= max;
  const hits = useApiQuery(['clients', 'picker', dq], () => api.get<{ items: ClassClientRef[] }>('/clients', { q: dq, pageSize: 8 }), {
    enabled: dq.length >= 2 && !full,
    staleTime: 10_000,
  });
  const taken = new Set([...value.map((v) => v.id), ...exclude]);
  const results = dq.length >= 2 && !full ? (hits.data?.items ?? []).filter((c) => !taken.has(c.id)) : [];

  return (
    <View style={{ gap: 6 }}>
      <T variant="label">
        {label}
        {hideCount ? null : <T variant="caption"> ({value.length}/{max})</T>}
      </T>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((c) => (
            <View key={c.id} style={styles.chip}>
              <T style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{clientName(c)}</T>
              <Pressable
                onPress={() => onChange(value.filter((v) => v.id !== c.id))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${clientName(c)} kişisini çıkar`}
                disabled={disabled}
                style={styles.chipX}
              >
                <Icon name="x" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {full ? (
        <T variant="caption">{max > 0 ? 'Kontenjan doldu. Başka kişi eklemek için kontenjanı artırın.' : 'Kontenjanda yer yok.'}</T>
      ) : (
        <>
          <TextField
            value={q}
            onChange={setQ}
            placeholder="Danışan ara: ad, soyad veya telefon"
            icon="search"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!disabled}
            accessibilityLabel="Danışan ara"
          />
          {hits.isFetching && dq.length >= 2 ? <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start' }} /> : null}
          {results.length > 0 ? (
            <View style={styles.results}>
              {results.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onChange([...value, { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone }]);
                    setQ('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${clientName(c)} ekle`}
                  style={({ pressed }) => [styles.result, i < results.length - 1 && styles.line, pressed && { backgroundColor: '#F8F4EE' }]}
                >
                  <Icon name="user-plus" size={16} color={colors.goldInk} />
                  <T variant="subheading" style={{ flex: 1 }} numberOfLines={1}>{clientName(c)}</T>
                  <T variant="caption">{formatPhone(c.phone)}</T>
                </Pressable>
              ))}
            </View>
          ) : null}
          {dq.length >= 2 && !hits.isFetching && hits.data && !results.length ? (
            <T variant="caption">Eşleşen danışan yok. Yeni kişiyi önce “Danışanlar” bölümünden ekleyin.</T>
          ) : null}
        </>
      )}
      {error ? <T variant="caption" color={colors.dangerInk}>{error}</T> : hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipX: { padding: 6, borderRadius: radius.pill },
  results: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.md, minHeight: 48 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
