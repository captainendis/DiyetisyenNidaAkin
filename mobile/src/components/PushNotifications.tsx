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
import { useEffect, useRef } from 'react';
import { onBeforeLogout, useAuth } from '@/lib/auth';
import { ensureAndroidChannel, pushSupported, pushTarget, registerPush, unregisterPush, type PushKind } from '@/lib/push';

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

  useEffect(() => {
    if (!pushSupported) return;
    void ensureAndroidChannel();
    return onBeforeLogout(async (k) => {
      registeredFor.current = null;
      await unregisterPush(k);
    });
  }, []);

  // Oturum açıldı → izin + token kaydı
  useEffect(() => {
    if (!pushSupported || !kind || !identity || registeredFor.current === identity) return;
    registeredFor.current = identity;
    void registerPush(kind).then((ok) => {
      if (!ok && registeredFor.current === identity) registeredFor.current = null;
    });
  }, [kind, identity]);

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

  return null;
}
