// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan seçici (arama ile) — kişiye özel tarifler ve yeni plan için (web: ClientPicker.tsx) */
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, T, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { useDebounced, type ClientRef } from './api';

type Hit = ClientRef & { phone: string };

export function ClientPicker({
  value,
  onChange,
  label = 'Danışan',
  hint,
  error,
  disabled,
  required,
}: {
  value: ClientRef | null;
  onChange: (c: ClientRef | null) => void;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const hits = useApiQuery(['clients', 'picker', dq], () => api.get<{ items: Hit[] }>('/clients', { q: dq, pageSize: 6 }), {
    enabled: !value && dq.length >= 2,
  });

  if (value) {
    return (
      <View style={{ gap: 6 }}>
        <T variant="label">{label}</T>
        <View style={styles.selected}>
          <T variant="subheading" style={{ flex: 1 }}>{value.firstName} {value.lastName}</T>
          {!disabled ? (
            <Button
              title="Kaldır"
              variant="ghost"
              size="sm"
              onPress={() => {
                setQ('');
                onChange(null);
              }}
            />
          ) : null}
        </View>
        {hint ? <T variant="caption">{hint}</T> : null}
      </View>
    );
  }
  const items = dq.length >= 2 ? hits.data?.items ?? [] : [];
  return (
    <View style={{ gap: 6 }}>
      <TextField
        label={label}
        required={required}
        placeholder="Ad, soyad veya telefon ile arayın"
        value={q}
        onChange={setQ}
        editable={!disabled}
        error={error}
        help={hint}
        icon="search"
        autoCorrect={false}
      />
      {hits.isFetching && dq.length >= 2 ? <ActivityIndicator color={colors.gold} /> : null}
      {items.length ? (
        <View style={styles.list}>
          {items.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => onChange({ id: c.id, firstName: c.firstName, lastName: c.lastName })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.hit, i < items.length - 1 && styles.line, pressed && { backgroundColor: '#F8F4EE' }]}
            >
              <T variant="subheading" style={{ flex: 1 }}>{c.firstName} {c.lastName}</T>
              <T variant="caption">{formatPhone(c.phone)}</T>
            </Pressable>
          ))}
        </View>
      ) : dq.length >= 2 && hits.data && !hits.isFetching ? (
        <T variant="caption">Eşleşen danışan yok.</T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingLeft: space.md, minHeight: 48 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  hit: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 44 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
