// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesindeki hizmet kartının sadeleştirilmiş önizlemesi (koyu zemin — açık renk metin) */
import { StyleSheet, View } from 'react-native';
import { T } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme';
import { ServiceIcon } from './ServiceIcon';

export function ServicePreviewCard({
  title,
  summary,
  icon,
  durationMinutes,
  priceCents,
  showPrice,
  index = 0,
}: {
  title: string;
  summary: string;
  icon: string;
  durationMinutes?: number | null;
  priceCents?: number | null;
  showPrice?: boolean;
  index?: number;
}) {
  const price = showPrice && priceCents != null;
  return (
    <View style={styles.card} accessible accessibilityLabel={`Sitedeki görünüm: ${title || 'Hizmet başlığı'}`}>
      <View style={styles.top}>
        <ServiceIcon name={icon} size={34} color={colors.rose} />
        <T style={{ fontFamily: fonts.display, fontSize: 17, color: colors.gold }}>{String(index + 1).padStart(2, '0')}</T>
      </View>
      <T style={styles.title}>{title || 'Hizmet başlığı'}</T>
      <T style={styles.summary}>{summary || 'Kısa açıklama burada görünür.'}</T>
      {durationMinutes || price ? (
        <View style={styles.meta}>
          <T style={styles.metaText}>
            {durationMinutes ? `${durationMinutes} dk` : ''}
            {durationMinutes && price ? ' · ' : ''}
            {price ? formatMoney(priceCents) : ''}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.espresso, borderRadius: radius.sm, padding: space.xl, gap: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.lg },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 29, color: colors.cream },
  summary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.mist },
  meta: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(244,235,221,0.15)', paddingTop: space.md, marginTop: space.sm },
  metaText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.4, color: 'rgba(244,235,221,0.75)', textTransform: 'uppercase' },
});
