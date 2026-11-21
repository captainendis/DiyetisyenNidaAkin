// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Anlık bildirimler (görünmez bileşen; _layout.tsx içinde AuthProvider altında):
 *  - Oturum açılınca (personel ya da danışan) izin ister ve token'ı doğru uca kaydeder (lib/push.ts)
 *  - Çıkıştan önce token'ı sunucudan siler (auth.tsx → onBeforeLogout)
 *  - Uygulama açıkken bildirim gelirse ilgili sorguları tazeler (personel: bildirimler/randevular, danışan: portal)
 *  - Bildirime dokunulunca data.url rotasını açar — uygulama kapalıyken açıldıysa da (useLastNotificationResponse)
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Sheet, T } from '@/components/ui';
import { onBeforeLogout, useAuth } from '@/lib/auth';
import {
  ensureAndroidChannel,
  getPushConsent,
  onPushConsentChange,
  pushSupported,
  pushTarget,
  registerPush,
  setPushConsent,
  unregisterPush,
  type PushConsent,
  type PushKind,
} from '@/lib/push';
import { space } from '@/theme';

/** Aynı bildirime dokunuşu iki kez işlememek için (yeniden bağlanmalarda da) */
const handled = new Set<string>();

/** Web önizlemesinde (ve bildirim desteklemeyen ortamlarda) hiç bağlanmaz: kancalar yerel modül ister */
export function PushNotifications() {
  return pushSupported ? <PushNotificationsInner /> : null;
}

function PushNotificationsInner() {
  const { state, sessionEpoch } = useAuth();
  const qc = useQueryClient();
  const navReady = !!useRootNavigationState()?.key;
  const kind: PushKind | null = state.status === 'staff' ? 'staff' : state.status === 'client' ? 'client' : null;
  // Her oturum için kaydı bir kez yap: sunucuda kayıt oturuma bağlıdır (şifre değişince yeni oturum → yeniden kayıt)
  const who = state.status === 'staff' ? `staff:${state.user.id}` : state.status === 'client' ? `client:${state.me.email}` : null;
  const identity = who && sessionEpoch > 0 ? `${who}#${sessionEpoch}` : null;
  const registeredFor = useRef<string | null>(null);
  // undefined: henüz okunmadı; null: hiç sorulmadı
  const [consent, setConsent] = useState<PushConsent | undefined>(undefined);

  useEffect(() => {
    if (!pushSupported) return;
    let alive = true;
    void getPushConsent().then((c) => alive && setConsent(c));
    const off = onPushConsentChange(setConsent);
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Rıza geri alındı → bu cihazın kaydı sunucudan silinir, bildirim gönderimi durur
  useEffect(() => {
    if (consent !== 'declined' || !kind) return;
    registeredFor.current = null;
    void unregisterPush(kind);
  }, [consent, kind]);

  useEffect(() => {
    if (!pushSupported) return;
    void ensureAndroidChannel();
    return onBeforeLogout(async (k) => {
      registeredFor.current = null;
      await unregisterPush(k);
    });
  }, []);

  // Oturum açıldı ve açık rıza var → izin + token kaydı
  useEffect(() => {
    if (!pushSupported || consent !== 'granted' || !kind || !identity || registeredFor.current === identity) return;
    registeredFor.current = identity;
    void registerPush(kind).then((ok) => {
      if (!ok && registeredFor.current === identity) registeredFor.current = null;
    });
  }, [kind, identity, consent]);

  // Uygulama açıkken gelen bildirim → ilgili verileri tazele
  useEffect(() => {
    if (!pushSupported || !kind) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      if (kind === 'staff') {
        void qc.invalidateQueries({ queryKey: ['notifications'] });
        void qc.invalidateQueries({ queryKey: ['appointments'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      } else {
        void qc.invalidateQueries({ queryKey: ['portal'] });
      }
    });
    return () => sub.remove();
  }, [kind, qc]);

  // Dokunma (soğuk açılış dahil) → rota. Gezinme ağacı ve oturum hazır olana kadar bekler.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!pushSupported || !response || !kind || !navReady) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.has(id)) return;
    handled.add(id);
    const href = pushTarget(response.notification.request.content.data, kind);
    Notifications.clearLastNotificationResponse();
    if (!href) return;
    // Korumalı bölüm (Stack.Protected) bu karede yeni açılmış olabilir: bir sonraki döngüde gez.
    // (Temizlemede iptal edilmez: clearLastNotificationResponse yanıtı null yapıp bu etkiyi yeniden çalıştırır.)
    setTimeout(() => router.push(href as never), 0);
  }, [response, kind, navReady]);

  return <PushConsentSheet visible={!!kind && !!identity && consent === null} kind={kind ?? 'client'} />;
}

/** Bildirimlerden önce bir kez sorulur (Açık Rıza Metni §3). "Şimdi değil" de kaydedilir; danışan Hesap ekranından değiştirebilir. */
function PushConsentSheet({ visible, kind }: { visible: boolean; kind: PushKind }) {
  const client = kind === 'client';
  return (
    <Sheet visible={visible} onClose={() => void setPushConsent('declined')} title="Bildirimler" subtitle="Açık rıza">
      <T>
        {client
          ? 'Randevun onaylandığında, yeni listen hazır olduğunda ya da diyetisyeninden mesaj geldiğinde telefonuna bildirim gönderebiliriz.'
          : 'Yeni randevu talepleri, iptaller ve hatırlatmalar için telefona bildirim gönderilebilir.'}
      </T>
      <T variant="caption">
        Bildirimin telefona ulaşması için cihazın bildirim adresi ve bildirim metni Expo, Inc. (ABD) ile Google veya Apple bildirim servisleri üzerinden yurt dışına aktarılır. Bildirim metinlerinde sağlık bilgisi yer almaz. Yurt dışındaki hizmet sağlayıcılar Türkiye'deki ile aynı düzeyde koruma sağlamayabilir.
      </T>
      <T variant="caption">
        {client
          ? 'İzin vermezsen uygulama aynı şekilde çalışır; yalnızca bildirim gelmez. Kararını istediğin zaman Hesap ekranından değiştirebilirsin. Ayrıntılar web sitesindeki Açık Rıza Metni ve KVKK Aydınlatma Metni\'nde.'
          : 'İzin verilmezse uygulama aynı şekilde çalışır; yalnızca bildirim gelmez. Ayrıntılar web sitesindeki Açık Rıza Metni ve KVKK Aydınlatma Metni\'nde.'}
      </T>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Button title="Yurt dışına aktarıma izin veriyorum" onPress={() => void setPushConsent('granted')} full />
        <Button title="Şimdi değil" variant="secondary" onPress={() => void setPushConsent('declined')} full />
      </View>
    </Sheet>
  );
}
