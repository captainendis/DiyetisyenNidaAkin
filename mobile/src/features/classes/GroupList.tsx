// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Pilates grupları: aktif / pasif liste */
import { router } from 'expo-router';
import { Button, Card, Empty, ListItem, QueryView, Screen, Section, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { classKeys, patternLabel, SeatDots, type ClassGroupDTO } from './shared';

export function useGroups() {
  return useApiQuery(classKeys.groups, () => api.get<{ items: ClassGroupDTO[] }>('/classes/groups'));
}

export function GroupList({ canWrite, onNewGroup }: { canWrite: boolean; onNewGroup: () => void }) {
  const q = useGroups();
  const row = (g: ClassGroupDTO, i: number, arr: ClassGroupDTO[]) => (
    <ListItem
      key={g.id}
      icon={g.isActive ? 'users' : 'pause-circle'}
      title={g.name}
      subtitle={g.pattern.length ? patternLabel(g.pattern) : 'Planlı ders yok'}
      right={<SeatDots taken={g.members.length} capacity={g.capacity} />}
      onPress={() => router.push(`/panel/pilates/grup/${g.id}`)}
      last={i === arr.length - 1}
    />
  );
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} contentStyle={{ paddingBottom: 110 }}>
      <T variant="caption" style={{ marginBottom: 16 }}>
        Grupları ve üyeleri yönetin; derslerde yapılanları ve sonraki derslerin planını not alın.
      </T>
      <QueryView query={q}>
        {({ items }) => {
          if (!items.length) {
            return (
              <Empty
                icon="users"
                title="Henüz pilates grubu yok."
                text="Sabit saatte birlikte ders alan danışanları bir grupta toplayın. Ardından gruba haftalık ders programı ekleyebilirsiniz."
                action={canWrite ? <Button title="İlk grubu oluştur" icon="plus" onPress={onNewGroup} /> : undefined}
              />
            );
          }
          const active = items.filter((g) => g.isActive);
          const passive = items.filter((g) => !g.isActive);
          return (
            <>
              <Section title="Aktif gruplar">
                {active.length ? <Card padded={false}>{active.map(row)}</Card> : <T muted>Aktif grup yok.</T>}
              </Section>
              {passive.length ? (
                <Section title="Pasif gruplar">
                  <Card padded={false}>{passive.map(row)}</Card>
                </Section>
              ) : null}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
