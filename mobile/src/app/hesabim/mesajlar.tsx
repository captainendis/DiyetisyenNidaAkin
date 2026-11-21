// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Mesajlar (web: PortalMessagesPage) — diyetisyenin görüşmelerden sonra bıraktığı notlar */
import { Stack } from 'expo-router';
import { View } from 'react-native';
import type { PortalMessage } from '@shared/portal';
import { Card, Empty, QueryView, Screen, T } from '@/components/ui';
import { PK } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';

export default function MessagesScreen() {
  const q = useApiQuery(PK.messages, () => portalApi.get<{ items: PortalMessage[] }>('/messages'));
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Mesajlar' }} />
      <T muted style={{ marginBottom: space.lg }}>Diyetisyeninin görüşmelerden sonra sana bıraktığı notlar ve öneriler.</T>
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Empty icon="message-circle" title="Henüz mesaj yok." text="Diyetisyenin sana bir not bıraktığında burada göreceksin." />
          ) : (
            <View style={{ gap: space.md }}>
              {data.items.map((m) => (
                <Card key={m.id}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2, marginBottom: space.sm }}>
                    <T variant="label" color={colors.cocoa}>{formatDate(m.createdAt)}</T>
                    {m.appointmentAt ? <T variant="caption">{formatDate(m.appointmentAt)} görüşmesi</T> : null}
                    {m.author ? <T variant="caption">{m.author}</T> : null}
                  </View>
                  <T selectable style={{ lineHeight: 23 }}>{m.content}</T>
                </Card>
              ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}
