// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Basit Markdown düzenleyici: araç çubuğu + Yaz / Önizleme (web: MarkdownEditor.tsx) */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon, Markdown, Segmented, T, type IconName } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

type Tool = 'h2' | 'bold' | 'italic' | 'ul' | 'ol' | 'link';
const TOOLS: { k: Tool; label: string; icon?: IconName; text?: string }[] = [
  { k: 'h2', label: 'Ara başlık', text: 'H2' },
  { k: 'bold', label: 'Kalın', icon: 'bold' },
  { k: 'italic', label: 'İtalik', icon: 'italic' },
  { k: 'ul', label: 'Madde listesi', icon: 'list' },
  { k: 'ol', label: 'Numaralı liste', text: '1.' },
  { k: 'link', label: 'Bağlantı', icon: 'link-2' },
];

export function MarkdownEditor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [view, setView] = useState<'write' | 'preview'>('write');
  const sel = useRef({ start: value.length, end: value.length });

  /** Seçimi sarmalar veya satır başına önek ekler */
  const apply = (kind: Tool) => {
    const s = Math.min(sel.current.start, value.length);
    const e = Math.min(sel.current.end, value.length);
    const selected = value.slice(s, e);
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    if (kind === 'bold' || kind === 'italic') {
      const mark = kind === 'bold' ? '**' : '*';
      const text = selected || (kind === 'bold' ? 'kalın metin' : 'italik metin');
      onChange(value.slice(0, s) + `${mark}${text}${mark}` + value.slice(e));
    } else if (kind === 'link') {
      const text = selected || 'bağlantı metni';
      onChange(value.slice(0, s) + `[${text}](https://)` + value.slice(e));
    } else {
      const prefix = kind === 'h2' ? '## ' : '- ';
      const block = value.slice(lineStart, Math.max(e, lineStart));
      const lines = block.split('\n').map((l, i) => (kind === 'ol' ? `${i + 1}. ` : prefix) + l.replace(/^(#{1,3}\s|[-*]\s|\d+\.\s)/, ''));
      onChange(value.slice(0, lineStart) + lines.join('\n') + value.slice(Math.max(e, lineStart)));
    }
  };

  const words = value.split(/\s+/).filter(Boolean).length;

  return (
    <View style={{ gap: 6 }}>
      <Segmented<'write' | 'preview'> value={view} onChange={setView} options={[{ value: 'write', label: 'Yaz' }, { value: 'preview', label: 'Önizleme' }]} />
      <View style={[styles.box, !!error && { borderColor: colors.danger }]}>
        {view === 'write' ? (
          <>
            <View style={styles.toolbar}>
              {TOOLS.map((t) => (
                <Pressable key={t.k} onPress={() => apply(t.k)} accessibilityRole="button" accessibilityLabel={t.label} hitSlop={4} style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.surface }]}>
                  {t.icon ? <Icon name={t.icon} size={17} color={colors.text} /> : <T style={{ fontFamily: fonts.bold, fontSize: 14 }}>{t.text}</T>}
                </Pressable>
              ))}
            </View>
            <TextInput
              value={value}
              onChangeText={onChange}
              onSelectionChange={(e) => (sel.current = e.nativeEvent.selection)}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Yazı içeriği"
              placeholder={'Yazınızı buraya yazın.\n\n## Ara başlık\nParagraflar arasında bir boş satır bırakın.\n\n- Madde listesi'}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </>
        ) : (
          <View style={styles.preview}>
            {value.trim() ? <Markdown source={value} /> : <T muted>Önizlenecek içerik yok.</T>}
          </View>
        )}
        <View style={styles.foot}>
          <T variant="caption" style={{ flex: 1 }} color={error ? colors.dangerInk : undefined}>
            {error ?? '## başlık · **kalın** · *italik* · - liste · [metin](https://…)'}
          </T>
          <T variant="caption">{words} kelime</T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 6, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line },
  tool: { minWidth: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 360, padding: space.md, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  preview: { minHeight: 360, padding: space.lg, backgroundColor: colors.ivory },
  foot: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
});
