// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Raporlar — randevu ve danışan istatistikleri, CSV dışa aktarım (web: ReportsPage.tsx) */
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Chips, DateField, Empty, ErrorView, FieldRow, Grid, Loading, Screen, Section, Segmented, StatTile, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { ProportionBars, VolumeChart } from './charts';
import { GRAINS, PRESETS, presetRange, type Grain, type Preset, type ReportBucket, type ReportData } from './types';

function BucketTable({ buckets }: { buckets: ReportBucket[] }) {
  const rows = buckets.filter((b) => b.total > 0);
  if (!rows.length) return <T variant="caption">Bu aralıkta randevu yok.</T>;
  return (
    <View>
      {rows.map((b, i) => (
        <View key={b.key} style={{ paddingVertical: 10, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: colors.line, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="subheading">{b.label}</T>
            <T variant="subheading">{b.total}</T>
          </View>
          <T variant="caption">
            Tamamlandı {b.completed} · Onaylı / bekleyen {b.confirmed + b.pending} · İptal {b.cancelled} · Gelmedi {b.noShow}
          </T>
        </View>
      ))}
    </View>
  );
}

export function ReportsScreen() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [grain, setGrain] = useState<Grain | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [downloading, setDownloading] = useState(false);
  const q = useApiQuery(['reports', range.from, range.to], () => api.get<ReportData>('/reports', range), { placeholderData: (prev) => prev });
  const data = q.data;

  const days = data?.range.days ?? 31;
  const autoGrain: Grain = days <= 45 ? 'daily' : days <= 200 ? 'weekly' : 'monthly';
  const g = grain ?? autoGrain;
  const buckets = data ? data[g] : [];
  const t = data?.totals;
  const resolved = t ? t.completed + t.cancelled + t.noShow : 0;
  const rangeLabel = `${formatDayStr(range.from, 'd MMM yyyy')} – ${formatDayStr(range.to, 'd MMM yyyy')}`;
  const grainWord = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' }[g];

  const outcomeRows = useMemo(
    () =>
      t
        ? [
            { key: 'c', label: 'Tamamlandı', value: t.completed },
            { key: 'x', label: 'İptal edildi', value: t.cancelled, tone: 'muted' as const },
            { key: 'n', label: 'Gelmedi', value: t.noShow, tone: 'muted' as const },
          ]
        : [],
    [t],
  );

  const download = async () => {
    setDownloading(true);
    try {
      await api.download('/reports/export.csv', `randevu-raporu-${range.from}_${range.to}.csv`, range);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Raporlar',
          headerRight: () => <Button title="CSV" icon="download" variant="ghost" size="sm" loading={downloading} disabled={!t?.appointments} onPress={() => void download()} />,
        }}
      />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
        <T muted style={{ marginBottom: space.md }}>Randevu ve danışan istatistikleri · {rangeLabel}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ paddingHorizontal: space.lg }}>
          <Chips<Preset>
            value={preset}
            onChange={(v) => {
              const p = v as Preset;
              setPreset(p);
              setGrain(null);
              if (p !== 'custom') setRange(presetRange(p));
            }}
            options={[...PRESETS, { value: 'custom', label: 'Özel' }]}
          />
        </ScrollView>
        {preset === 'custom' ? (
          <View style={{ marginTop: space.md }}>
            <FieldRow>
              <DateField label="Başlangıç" value={range.from} maximumDate={range.to} onChange={(v) => v && setRange((r) => ({ ...r, from: v }))} />
              <DateField label="Bitiş" value={range.to} minimumDate={range.from} onChange={(v) => v && setRange((r) => ({ ...r, to: v }))} />
            </FieldRow>
          </View>
        ) : null}

        <View style={{ height: space.xl }} />
        {q.error && !data ? (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        ) : !data || !t ? (
          <Loading />
        ) : (
          <View style={{ opacity: q.isFetching && !q.refreshing ? 0.6 : 1 }}>
            {q.error ? <T variant="caption" color={colors.dangerInk} style={{ marginBottom: space.md }}>{errorMessage(q.error)}</T> : null}
            <Section>
              <Grid>
                {[
                  <StatTile key="a" label="Randevu" value={t.appointments} hint="Bu aralıkta saati planlanmış tüm randevular (iptaller dahil)." />,
                  <StatTile key="c" label="Tamamlanan" value={t.completed} hint="Gerçekleşti olarak işaretlenen görüşmeler." />,
                  <StatTile key="n" label="Yeni danışan" value={t.newClients} hint="Bu aralıkta kaydı oluşturulan danışanlar." />,
                  <StatTile key="r" label="Tekrar gelen" value={t.returningClients} hint="Bu aralıkta görüşmesi tamamlanan ve toplamda en az 2 görüşmesi olan danışanlar." />,
                ]}
              </Grid>
            </Section>

            {t.appointments === 0 && t.untimedRequests === 0 ? (
              <Card>
                <Empty icon="bar-chart-2" title="Bu aralıkta randevu bulunmuyor." text="Farklı bir tarih aralığı seçin. Randevular oluşturuldukça grafikler burada görünecek." />
              </Card>
            ) : (
              <>
                <Section title={`${grainWord} randevu sayısı`}>
                  <Card style={{ gap: space.md }}>
                    <T variant="caption">Her çubuk o dönemde planlanmış randevuların toplamı.</T>
                    <Segmented<Grain> value={g} onChange={setGrain} options={GRAINS} />
                    <Segmented<'chart' | 'table'> value={view} onChange={setView} options={[{ value: 'chart', label: 'Grafik' }, { value: 'table', label: 'Tablo' }]} />
                    {view === 'chart' ? (
                      <VolumeChart key={`${g}-${range.from}-${range.to}`} buckets={buckets} ariaLabel={`${grainWord} randevu sayısı, ${rangeLabel}. Toplam ${t.appointments} randevu.`} />
                    ) : (
                      <BucketTable buckets={buckets} />
                    )}
                  </Card>
                </Section>

                <Section title="Randevular nasıl sonuçlandı?">
                  <Card style={{ gap: space.lg }}>
                    <T variant="caption">Sonuçlanan {resolved} randevu içinde dağılım.</T>
                    {resolved ? <ProportionBars rows={outcomeRows} total={resolved} /> : <T variant="caption">Bu aralıkta henüz sonuçlanmış randevu yok.</T>}
                    {t.confirmed > 0 || t.pending > 0 || t.untimedRequests > 0 ? (
                      <T variant="caption" style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md }}>
                        Henüz sonuçlanmamış: <T variant="caption" weight="semibold" color={colors.text}>{t.confirmed}</T> onaylı,{' '}
                        <T variant="caption" weight="semibold" color={colors.text}>{t.pending}</T> onay bekleyen
                        {t.untimedRequests > 0 ? (
                          <>
                            , <T variant="caption" weight="semibold" color={colors.text}>{t.untimedRequests}</T> saat belirtilmemiş talep
                          </>
                        ) : null}
                        .
                      </T>
                    ) : null}
                  </Card>
                </Section>

                <Section title="Randevular nereden ve nasıl?">
                  <Card style={{ gap: space.xl }}>
                    <T variant="caption">Görüşme türü ve randevunun oluşturulduğu yer.</T>
                    <ProportionBars
                      total={t.appointments}
                      rows={[
                        { key: 'ip', label: 'Yüz yüze', value: data.byMeetingType.IN_PERSON },
                        { key: 'on', label: 'Online', value: data.byMeetingType.ONLINE, tone: 'muted' },
                      ]}
                    />
                    <ProportionBars
                      total={t.appointments}
                      rows={[
                        { key: 'w', label: 'Web sitesi talebi', value: data.bySource.WEBSITE },
                        { key: 'p', label: 'Panelden oluşturulan', value: data.bySource.PANEL, tone: 'muted' },
                      ]}
                    />
                  </Card>
                </Section>
              </>
            )}
            <Button title="CSV olarak indir" icon="download" variant="secondary" full loading={downloading} disabled={!t.appointments} onPress={() => void download()} />
            <T variant="caption" style={{ marginTop: space.lg }}>
              Gelir raporları, ücret ve ödeme takibi modülü eklendiğinde kullanılabilir olacak. Raporlar ve CSV dosyası klinik veri içermez.
            </T>
          </View>
        )}
      </Screen>
    </>
  );
}
