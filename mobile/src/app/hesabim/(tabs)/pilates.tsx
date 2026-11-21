// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Pilates (web: PortalPilatesPage) — grup(lar), yaklaşan ve geçmiş dersler, katılım özeti, ders talebi.
 * Diğer katılımcıların bilgisi gösterilmez. Talep Randevular'a saatsiz yeni talep olarak düşer.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { PILATES_FORMAT_LABEL, WEEKDAY_LABEL, pilatesPreferenceText } from '@shared/constants';
import type { PortalPilates } from '@shared/portal';
import { Badge, Button, Card, Empty, ListItem, QueryView, Screen, Section, T } from '@/components/ui';
import { ClassRow } from '@/features/portal/ClassRow';
import { PilatesRequestSheet } from '@/features/portal/PilatesRequestSheet';
import { PK } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';

const patternText = (p: { weekday: number; time: string }[]) => p.map((x) => `${WEEKDAY_LABEL[x.weekday]} ${x.time}`).join(', ');

export default function PilatesTab() {
  const q = useApiQuery(PK.pilates, () => portalApi.get<PortalPilates>('/pilates'));
  const [requestOpen, setRequestOpen] = useState(false);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <T muted style={{ marginBottom: space.lg }}>Derslerin, katılımın ve ders taleplerin. Gelemeyeceğin bir ders olursa önceden haber ver; yerin telafi için açılabilsin.</T>
      <QueryView query={q}>
        {(data) => {
          const next = data.upcoming[0] ?? null;
          return (
            <>
              {next ? (
                <Section title="Sıradaki dersin">
                  <Card>
                    <T style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.text }}>{formatDate(next.startsAt)}</T>
                    <T variant="subheading">{formatTime(next.startsAt)}–{formatTime(next.endsAt)}</T>
                    <T variant="caption" style={{ marginTop: 4 }}>{next.title}</T>
                  </Card>
                </Section>
              ) : (
                <Empty icon="activity" title="Planlanmış dersin yok." text="Bir gruba katılmak ya da birebir ders almak için talep gönderebilirsin." />
              )}

              <Button title="Ders talep et" icon="send" full onPress={() => setRequestOpen(true)} style={{ marginBottom: space.xl }} />

              {data.requests.length > 0 ? (
                <Section title="Yanıt bekleyen taleplerin">
                  <Card padded={false}>
                    {data.requests.map((r, i) => (
                      <ListItem
                        key={r.id}
                        icon="clock"
                        title={r.pilatesFormat ? PILATES_FORMAT_LABEL[r.pilatesFormat] : 'Pilates'}
                        subtitle={`${pilatesPreferenceText(r.preferredDays, r.preferredDayparts)} · ${formatDate(r.createdAt)}`}
                        right={<Badge label="Yanıt bekliyor" tone="warning" />}
                        last={i === data.requests.length - 1}
                      />
                    ))}
                  </Card>
                </Section>
              ) : null}

              {data.groups.length > 0 ? (
                <Section title={data.groups.length > 1 ? 'Grupların' : 'Grubun'}>
                  <Card>
                    <View style={{ gap: space.md }}>
                      {data.groups.map((g) => (
                        <View key={g.id}>
                          <T variant="title" style={{ fontSize: 22, lineHeight: 26 }}>{g.name}</T>
                          <T variant="caption">{g.pattern.length ? patternText(g.pattern) : 'Ders saatleri yakında planlanacak'} · {g.durationMinutes} dk</T>
                        </View>
                      ))}
                    </View>
                  </Card>
                </Section>
              ) : null}

              {data.upcoming.length > 1 ? (
                <Section title="Yaklaşan dersler">
                  <Card padded={false}>
                    {data.upcoming.slice(1).map((s, i, arr) => <ClassRow key={s.id} s={s} last={i === arr.length - 1} />)}
                  </Card>
                </Section>
              ) : null}

              {data.past.length > 0 ? (
                <Section title="Geçmiş dersler">
                  <T variant="caption" style={{ marginBottom: space.sm }}>
                    {data.stats.attended} katıldın{data.stats.excused ? ` · ${data.stats.excused} haber verdin` : ''}{data.stats.noShow ? ` · ${data.stats.noShow} gelmedin` : ''}
                  </T>
                  <Card padded={false}>
                    {data.past.map((s, i) => <ClassRow key={s.id} s={s} last={i === data.past.length - 1} />)}
                  </Card>
                </Section>
              ) : null}
            </>
          );
        }}
      </QueryView>
      <PilatesRequestSheet visible={requestOpen} onClose={() => setRequestOpen(false)} />
    </Screen>
  );
}
