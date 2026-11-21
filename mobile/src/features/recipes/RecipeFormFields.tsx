// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif formu alanları (useRecipeForm ile) — Sheet ya da ekran içinde kullanılır */
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chips, FieldRow, Form, Icon, IconButton, Notice, Sortable, SwitchField, T, TextField } from '@/components/ui';
import { SITE_URL } from '@/lib/config';
import { colors, radius, space } from '@/theme';
import { DIET_TAGS, DIET_TAG_LABEL, DIET_TAG_NOTE, MAX_FEATURED_RECIPES, RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, type RecipeCategory } from '@shared/recipe';
import { recipeImage } from './api';
import { ClientPicker } from './ClientPicker';
import type { RecipeForm } from './useRecipeForm';

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

export function RecipeFormFields({ form }: { form: RecipeForm }) {
  const { d, err, editing, isVariant, image, set } = form;
  const uri = image ? ('local' in image ? image.local : recipeImage(image.base, 960)) : null;

  return (
    <Form>
      {editing && (editing.parent || editing.variantCount > 0) ? (
        <Notice
          tone="gold"
          icon="git-branch"
          text={[
            editing.parent ? `Bu tarif “${editing.parent.title}” tarifinin varyasyonudur.` : '',
            editing.variantCount > 0 ? `Bu tarifin ${editing.variantCount} varyasyonu var; buradaki değişiklikler onları etkilemez.` : '',
          ].filter(Boolean).join(' ')}
        />
      ) : null}

      {/* Fotoğraf */}
      <View style={{ gap: 6 }}>
        <T variant="label">Fotoğraf</T>
        <Pressable onPress={() => void form.pickImage('library')} accessibilityRole="button" accessibilityLabel={uri ? 'Fotoğrafı değiştir' : 'Fotoğraf seçin'} style={styles.photo}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Icon name="image" size={26} color={colors.muted} />
              <T variant="label" color={colors.muted}>Fotoğraf seçin</T>
              <T variant="caption">JPG, PNG, WebP veya AVIF · en fazla 15 MB</T>
            </View>
          )}
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <Button title={uri ? 'Değiştir' : 'Galeriden seç'} icon="image" variant="secondary" size="sm" onPress={() => void form.pickImage('library')} />
          <Button title="Fotoğraf çek" icon="camera" variant="secondary" size="sm" onPress={() => void form.pickImage('camera')} />
          {uri ? <Button title="Kaldır" icon="x" variant="ghost" size="sm" onPress={form.clearImage} /> : null}
        </View>
        <T variant="caption">4:3 kırpılır; konum ve cihaz bilgisi silinir.</T>
      </View>

      <TextField label="Tarif adı" required value={d.title} maxLength={80} error={err.title} placeholder="Yulaflı tost" onChange={(v) => set('title', v)} />
      <View style={{ gap: 6 }}>
        <Chips<RecipeCategory>
          label="Kategori *"
          value={d.category || null}
          options={RECIPE_CATEGORIES.map((c) => ({ value: c, label: RECIPE_CATEGORY_LABEL[c] }))}
          onChange={(v) => set('category', v as RecipeCategory)}
        />
        {err.category ? <T variant="caption" color={colors.dangerInk}>{err.category}</T> : null}
      </View>
      <TextField label="Kısa açıklama" rows={2} value={d.summary} maxLength={200} error={err.summary} placeholder="Tok tutan, 10 dakikada hazır bir kahvaltı." onChange={(v) => set('summary', v)} />

      {isVariant ? (
        <View style={styles.box}>
          <TextField
            label="Varyasyon notu"
            value={d.variantNote}
            maxLength={120}
            error={err.variantNote}
            placeholder="Laktozsuz, glutensiz ekmekle"
            help="Neyin değiştiğini kısaca yazın; PDF'te tarif adının altında görünür."
            onChange={(v) => set('variantNote', v)}
          />
          <ClientPicker
            label="Kişiye özel (isteğe bağlı)"
            value={d.client}
            onChange={form.setClient}
            hint={
              d.client
                ? 'Yalnızca bu danışanın planlarında önerilir, PDF’te “Sana özel” olarak basılır. Danışan silinirse bu tarif de silinir.'
                : 'Boş bırakılırsa genel bir varyasyon olur (ör. vegan versiyon).'
            }
          />
        </View>
      ) : null}

      <View style={styles.box}>
        <SwitchField
          label="Web sitesinde yayınla"
          help={d.client ? 'Kişiye özel tarifler yayınlanamaz.' : d.isPublished ? 'Sitedeki “Tarifler” bölümünde herkes görebilir.' : 'Kapalıyken yalnızca panelde ve planlarda kullanılır.'}
          value={!d.client && d.isPublished}
          disabled={!!d.client}
          onChange={(v) => set('isPublished', v)}
        />
        {err.isPublished ? <T variant="caption" color={colors.dangerInk}>{err.isPublished}</T> : null}
        {!d.client && d.isPublished ? (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.sm, gap: 4 }}>
            <SwitchField
              label="Ana sayfada göster"
              help={`Ana sayfadaki “Mutfaktan” bölümünde öne çıkar (en fazla ${MAX_FEATURED_RECIPES} tarif).`}
              value={d.isFeatured}
              onChange={(v) => set('isFeatured', v)}
            />
            {err.isFeatured ? <T variant="caption" color={colors.dangerInk}>{err.isFeatured}</T> : null}
          </View>
        ) : null}
        {editing?.isPublished && editing.slug && d.isPublished ? (
          <Button title="Sitede görüntüle" icon="external-link" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => void Linking.openURL(`${SITE_URL}/tarifler/${editing.slug}`)} />
        ) : null}
      </View>

      <View style={styles.box}>
        <T variant="label">Diyet türü</T>
        {DIET_TAGS.map((t) => (
          <SwitchField
            key={t}
            label={DIET_TAG_LABEL[t]}
            help={DIET_TAG_NOTE[t]}
            value={d.dietTags.includes(t)}
            disabled={t === 'VEGETARIAN' && d.dietTags.includes('VEGAN')}
            onChange={(v) => form.toggleDiet(t, v)}
          />
        ))}
      </View>

      <FieldRow>
        <TextField label="Porsiyon" keyboardType="number-pad" value={d.servings} error={err.servings} placeholder="1" onChange={(v) => set('servings', digits(v, 2))} />
        <TextField label="Kalori (porsiyon)" keyboardType="number-pad" value={d.kcal} error={err.kcal} placeholder="kcal" onChange={(v) => set('kcal', digits(v, 4))} />
      </FieldRow>
      <FieldRow>
        <TextField label="Hazırlık (dk)" keyboardType="number-pad" value={d.prepMinutes} error={err.prepMinutes} placeholder="10" onChange={(v) => set('prepMinutes', digits(v, 4))} />
        <TextField label="Pişirme (dk)" keyboardType="number-pad" value={d.cookMinutes} error={err.cookMinutes} placeholder="15" onChange={(v) => set('cookMinutes', digits(v, 4))} />
      </FieldRow>

      <TextField
        label="Malzemeler"
        required
        rows={7}
        value={d.ingredients}
        error={err.ingredients}
        help="Her satıra bir malzeme ve miktarı."
        placeholder={'4 yemek kaşığı yulaf\n1 yumurta\n2 dilim beyaz peynir'}
        onChange={(v) => set('ingredients', v)}
      />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="label">
            Hazırlanışı<T variant="label" color={colors.roseInk}> *</T>
          </T>
          {d.steps.length < 15 ? <Button title="Adım ekle" icon="plus" variant="ghost" size="sm" onPress={form.addStep} /> : null}
        </View>
        <Sortable
          items={d.steps}
          keyOf={(_, i) => String(i)}
          gap={space.sm}
          labelOf={(_, i) => `${i + 1}. adım`}
          onReorder={form.moveStep}
          renderItem={(s, i, handle) => (
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: colors.bg }}>
            <View style={{ marginTop: 4 }}>{handle}</View>
            <View style={styles.stepNo}>
              <T variant="label" color={colors.cocoa}>{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <TextField accessibilityLabel={`${i + 1}. adım`} rows={3} value={s} maxLength={500} onChange={(v) => form.setStep(i, v)} />
            </View>
            <View style={{ marginTop: 4 }}>
              <IconButton name="trash-2" label="Adımı sil" color={d.steps.length === 1 ? colors.line : colors.dangerInk} onPress={() => d.steps.length > 1 && form.removeStep(i)} />
            </View>
          </View>
          )}
        />
        {err.steps ? <T variant="caption" color={colors.dangerInk}>{err.steps}</T> : null}
      </View>

      <TextField label="İpucu (isteğe bağlı)" rows={2} value={d.tip} maxLength={300} error={err.tip} placeholder="Akşamdan hazırlayıp buzdolabında saklayabilirsin." onChange={(v) => set('tip', v)} />
    </Form>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, width: '100%', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: '#EFE8DD', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  box: { gap: space.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, backgroundColor: colors.surface },
  stepNo: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
});
