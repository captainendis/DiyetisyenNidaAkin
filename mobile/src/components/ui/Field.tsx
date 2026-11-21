// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { formatDayStr } from '@/lib/format';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { T } from './Text';

function Label({ label, required, hint }: { label?: string; required?: boolean; hint?: string }) {
  if (!label) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
      <T variant="label">
        {label}
        {required ? <T variant="label" color={colors.roseInk}> *</T> : null}
      </T>
      {hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

function FieldError({ error, help }: { error?: string; help?: string }) {
  if (error) return <T variant="caption" color={colors.dangerInk}>{error}</T>;
  if (help) return <T variant="caption">{help}</T>;
  return null;
}

export interface TextFieldProps extends Omit<TextInputProps, 'onChange' | 'value'> {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  required?: boolean;
  icon?: IconName;
  /** Çok satırlı alan için satır sayısı */
  rows?: number;
}

export function TextField({ label, value, onChange, error, help, required, icon, rows, style, ...rest }: TextFieldProps) {
  const [focus, setFocus] = useState(false);
  const multiline = !!rows && rows > 1;
  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <View style={[styles.input, focus && styles.focus, !!error && styles.invalid, multiline && { alignItems: 'flex-start' }]}>
        {icon ? <Icon name={icon} size={17} color={colors.muted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholderTextColor={colors.mist}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label}
          style={[styles.textInput, multiline && { minHeight: rows! * 22, paddingTop: 12 }, style]}
          {...rest}
        />
      </View>
      <FieldError error={error} help={help} />
    </View>
  );
}

export interface Option<V extends string | number = string> {
  value: V;
  label: string;
  description?: string;
}

/** Seçim alanı — dokununca seçenek listesi alttan açılır */
export function SelectField<V extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seçin',
  error,
  help,
  required,
  disabled,
  searchable,
}: {
  label?: string;
  value: V | null | undefined;
  options: Option<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  error?: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const filtered = q ? options.filter((o) => o.label.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'))) : options;
  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${current?.label ?? placeholder}` : current?.label ?? placeholder}
        style={[styles.input, !!error && styles.invalid, disabled && { opacity: 0.5 }]}
      >
        <T style={{ flex: 1 }} color={current ? colors.text : colors.mist} numberOfLines={1}>{current?.label ?? placeholder}</T>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <FieldError error={error} help={help} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Seçin'}>
        {searchable ? <TextField value={q} onChange={setQ} placeholder="Ara…" icon="search" autoCorrect={false} /> : null}
        <View style={styles.optionList}>
          {filtered.map((o, i) => {
            const sel = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQ('');
                }}
                style={({ pressed }) => [styles.option, i < filtered.length - 1 && styles.optionLine, pressed && { backgroundColor: '#F8F4EE' }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
              >
                <View style={{ flex: 1 }}>
                  <T variant="subheading">{o.label}</T>
                  {o.description ? <T variant="caption">{o.description}</T> : null}
                </View>
                {sel ? <Icon name="check" size={18} color={colors.goldInk} /> : null}
              </Pressable>
            );
          })}
          {!filtered.length ? <T muted style={{ padding: space.lg }}>Sonuç yok</T> : null}
        </View>
      </Sheet>
    </View>
  );
}

/** Yatay seçim düğmeleri (az seçenek için) */
export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: Option<V>[]; onChange: (v: V) => void; label?: string }) {
  return (
    <View style={styles.field}>
      <Label label={label} />
      <View style={styles.segment}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.segmentItem, sel && styles.segmentSel]}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel }}
            >
              <T style={{ fontFamily: sel ? fonts.semibold : fonts.medium, fontSize: 13, color: sel ? colors.cream : colors.muted }} numberOfLines={1}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Çoklu/tekli seçim çipleri (yatayda kayar sarar) */
export function Chips<V extends string | number>({
  value,
  options,
  onChange,
  label,
  multiple,
}: {
  value: V[] | V | null;
  options: Option<V>[];
  onChange: (v: V[] | V) => void;
  label?: string;
  multiple?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value == null ? [] : [value];
  return (
    <View style={styles.field}>
      <Label label={label} />
      <View style={styles.chips}>
        {options.map((o) => {
          const sel = selected.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => {
                if (!multiple) return onChange(o.value);
                onChange(sel ? selected.filter((x) => x !== o.value) : [...selected, o.value]);
              }}
              style={[styles.chip, sel && styles.chipSel]}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: sel }}
            >
              <T style={{ fontFamily: fonts.medium, fontSize: 13, color: sel ? colors.cream : colors.text }}>{o.label}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchField({ label, value, onChange, help, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string; disabled?: boolean }) {
  return (
    <View style={[styles.switchRow]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="subheading">{label}</T>
        {help ? <T variant="caption">{help}</T> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.gold, false: colors.line }}
        thumbColor={Platform.OS === 'android' ? (value ? colors.espresso : '#fff') : undefined}
      />
    </View>
  );
}

// ───────────────────────── Tarih / saat ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const dateToStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const strToDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12);
};

/**
 * Tarih/saat seçici. Değer biçimleri sunucuyla aynı: tarih "YYYY-MM-DD", saat "HH:mm" (İstanbul saati).
 * iOS'ta alttan açılan sayfada, Android'de sistem penceresinde seçilir.
 */
function PickerField({
  mode,
  label,
  value,
  onChange,
  error,
  help,
  required,
  placeholder,
  minimumDate,
  maximumDate,
  clearable,
}: {
  mode: 'date' | 'time';
  label?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  required?: boolean;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toDate = (v: string | null | undefined) => {
    if (!v) return new Date();
    if (mode === 'date') return strToDate(v);
    const [h, m] = v.split(':').map(Number);
    const d = new Date();
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
  };
  const [draft, setDraft] = useState<Date>(toDate(value));
  const fmt = (d: Date) => (mode === 'date' ? dateToStr(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  const display = value ? (mode === 'date' ? formatDayStr(value, 'd MMMM yyyy, cccc') : value) : placeholder ?? (mode === 'date' ? 'Tarih seçin' : 'Saat seçin');

  const onAndroid = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false);
    if (e.type === 'set' && d) onChange(fmt(d));
  };

  return (
    <View style={styles.field}>
      <Label label={label} required={required} />
      <Pressable
        onPress={() => {
          setDraft(toDate(value));
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? ''} ${display}`}
        style={[styles.input, !!error && styles.invalid]}
      >
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={17} color={colors.muted} />
        <T style={{ flex: 1 }} color={value ? colors.text : colors.mist}>{display}</T>
        {clearable && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Temizle">
            <Icon name="x-circle" size={17} color={colors.mist} />
          </Pressable>
        ) : null}
      </Pressable>
      <FieldError error={error} help={help} />
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          is24Hour
          minuteInterval={mode === 'time' ? 5 : undefined}
          minimumDate={minimumDate ? strToDate(minimumDate) : undefined}
          maximumDate={maximumDate ? strToDate(maximumDate) : undefined}
          onChange={onAndroid}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label ?? (mode === 'date' ? 'Tarih' : 'Saat')}
          footer={
            <Button
              title="Seç"
              full
              style={{ flex: 1 }}
              onPress={() => {
                onChange(fmt(draft));
                setOpen(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={draft}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            locale="tr-TR"
            minuteInterval={mode === 'time' ? 5 : undefined}
            minimumDate={minimumDate ? strToDate(minimumDate) : undefined}
            maximumDate={maximumDate ? strToDate(maximumDate) : undefined}
            accentColor={colors.goldInk}
            themeVariant="light"
            onChange={(_, d) => d && setDraft(d)}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

export const DateField = (p: Omit<Parameters<typeof PickerField>[0], 'mode'>) => <PickerField mode="date" {...p} />;
export const TimeField = (p: Omit<Parameters<typeof PickerField>[0], 'mode' | 'minimumDate' | 'maximumDate'>) => <PickerField mode="time" {...p} />;

/** Form düzeni: alanları dikeyde aralıklı dizer */
export function Form({ children }: { children: ReactNode }) {
  return <View style={{ gap: space.lg }}>{children}</View>;
}

/** Yan yana iki alan */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: space.md }}>{Array.isArray(children) ? children.map((c, i) => <View key={i} style={{ flex: 1 }}>{c}</View>) : children}</View>;
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  focus: { borderColor: colors.gold },
  invalid: { borderColor: colors.danger },
  textInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 10 },
  optionList: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: space.lg, gap: space.md },
  optionLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  segment: { flexDirection: 'row', backgroundColor: '#EDE6DB', borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.pill },
  segmentSel: { backgroundColor: colors.espresso },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipSel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
});
