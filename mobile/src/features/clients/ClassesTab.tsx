// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan → Pilates: grup üyelikleri, yaklaşan dersler, katılım geçmişi ve özet */
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Empty, Grid, ListItem, QueryView, Section, StatTile, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { CLASS_ATTENDANCE_LABEL, CLASS_SESSION_STATUS_LABEL } from '@shared/constants';
import type { ClientClassSummary } from '@shared/classes';
import { space } from '@/theme';
import { ATTENDANCE_TONE, SESSION_TONE, clientKeys } from './types';

type Row = ClientClassSummary['upcoming'][number];

function SessionList({ rows, past }: { rows: Row[]; past?: boolean }) {
  return (
    <Card padded={false}>
      {rows.map((s, i) => (
        <ListItem
          key={s.id}
          last={i === rows.length - 1}
          title={`${formatDayStr(s.date, 'd MMM, ccc')} · ${s.time}`}
          subtitle={s.title}
          onPress={() => router.push(`/panel/pilates/ders/${s.id}`)}
          right={
            past && s.status !== 'COMPLETED' ? (
              <Badge label={CLASS_SESSION_STATUS_LABEL[s.status]} tone={SESSION_TONE[s.status]} />
            ) : (
              <Badge label={CLASS_ATTENDANCE_LABEL[s.myStatus]} tone={ATTENDANCE_TONE[s.myStatus]} />
            )
          }
        />
      ))}
    </Card>
  );
}

export function ClassesTab({ clientId }: { clientId: string }) {
  const q = useApiQuery(clientKeys.sub(clientId, 'classes'), () => api.get<ClientClassSummary>(`/classes/clients/${clientId}`));
  return (
    <QueryView query={q}>
      {(data) => {
        if (!data.groups.length && !data.upcoming.length && !data.past.length) {
          return (
            <Card>
              <Empty
                icon="activity"
                title="Pilates kaydı yok."
                text="Danışanı bir pilates grubuna ekleyin ya da tek bir derse telafi/misafir olarak kaydedin."
                action={<Button title="Pilates gruplarına git" variant="secondary" onPress={() => router.push('/panel/pilates')} />}
              />
            </Card>
          );
        }
        const { stats } = data;
        const done = stats.attended + stats.noShow;
        return (
          <View>
            <Card style={{ marginBottom: space.md, gap: space.sm }}>
              <T variant="overline">Grup</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {data.groups.length ? data.groups.map((g) => <Badge key={g.id} label={g.name} tone={g.isActive ? 'info' : 'neutral'} />) : <T variant="caption">Grupta değil</T>}
              </View>
            </Card>
            <View style={{ marginBottom: space.xl }}>
              <Grid>
                <StatTile label="Katıldığı ders" value={stats.attended} hint={done > 0 ? `Devam oranı %${Math.round((stats.attended / done) * 100)}` : undefined} />
                <StatTile label="Gelmedi / haber verdi" value={`${stats.noShow} / ${stats.excused}`} />
              </Grid>
            </View>
            <Section title={`Yaklaşan dersler (${data.upcoming.length})`}>
              {data.upcoming.length ? <SessionList rows={data.upcoming} /> : <T variant="caption">Planlı ders yok.</T>}
            </Section>
            <Section title="Geçmiş dersler" style={{ marginBottom: space.sm }}>
              {data.past.length ? <SessionList rows={data.past} past /> : <T variant="caption">Henüz geçmiş ders yok.</T>}
            </Section>
          </View>
        );
      }}
    </QueryView>
  );
}
