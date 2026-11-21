// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Anlık bildirim (Expo Push) — izin, token ve sunucu kaydı.
 *  - Sunucu: personel POST/DELETE /api/devices, danışan POST/DELETE /api/portal/devices (server/routes/devices.ts)
 *  - Token için EAS proje kimliği gerekir (app.json → extra.eas.projectId; `npx eas-cli init` yazar). Yoksa,
 *    web'de ya da simülatörde (Device.isDevice=false) sessizce atlanır.
 *  - İzin bir kez sorulur (Android 13+ ikinci kez sistem penceresi açabildiği için cihazda not edilir).
 *  - Çıkışta token sunucudan silinir (auth.tsx → onBeforeLogout); aynı telefon başka hesapla girerse sunucu sahipliği taşır.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, portalApi } from './api';

export type PushKind = 'staff' | 'client';

const ASKED_KEY = 'na.push.asked.v1';
/** Android bildirim kanalı (sunucu channelId: 'default' gönderir) */
export const ANDROID_CHANNEL_ID = 'default';

export const pushSupported = Platform.OS !== 'web';

/** Uygulama açıkken gelen bildirim de banner olarak gösterilir */
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let channelReady: Promise<unknown> | null = null;
/** Android 8+: bildirimler bir kanala bağlıdır; izin isteğinden ÖNCE oluşturulmalı (Android 13 izin penceresi için) */
export function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Bildirimler',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#211710',
    vibrationPattern: [0, 200, 120, 200],
    showBadge: true,
  }).catch((e) => {
    channelReady = null;
    console.warn('[push] Android kanalı oluşturulamadı', e);
  });
  return channelReady;
}

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

async function askedBefore() {
  try {
    return (await SecureStore.getItemAsync(ASKED_KEY)) === '1';
  } catch {
    return false;
  }
}
async function markAsked() {
  try {
    await SecureStore.setItemAsync(ASKED_KEY, '1');
  } catch {
    /* önemsiz */
  }
}

/** İzin (gerekirse bir kez sorar) → Expo push token. Desteklenmiyorsa ya da izin yoksa null. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!pushSupported) return null;
  if (!Device.isDevice) {
    console.warn('[push] Simülatör/emülatörde anlık bildirim alınamaz; kayıt atlandı.');
    return null;
  }
  const pid = projectId();
  if (!pid) {
    console.warn('[push] EAS projectId yok (app.json → extra.eas.projectId). `npx eas-cli init` sonrası etkinleşir; kayıt atlandı.');
    return null;
  }
  await ensureAndroidChannel();
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain && !(await askedBefore())) {
    await markAsked();
    perm = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  }
  const iosProvisional = perm.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!perm.granted && !iosProvisional) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
  return data;
}

const client = (kind: PushKind) => (kind === 'staff' ? api : portalApi);

/** Bu oturumda sunucuya kaydedilen token (çıkışta silmek için) */
let registered: { kind: PushKind; token: string } | null = null;

/** Token'ı oturumun sahibine kaydeder (her açılışta lastSeen tazelenir). Hata fırlatmaz. */
export async function registerPush(kind: PushKind): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;
    await client(kind).post('/devices', { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' });
    registered = { kind, token };
    return true;
  } catch (e) {
    console.warn('[push] kayıt başarısız', e);
    return false;
  }
}

/** Çıkıştan ÖNCE çağrılır (oturum hâlâ geçerliyken). Hata fırlatmaz. */
export async function unregisterPush(kind: PushKind): Promise<void> {
  const r = registered;
  if (!r || r.kind !== kind) return;
  registered = null;
  try {
    await client(kind).del(`/devices/${encodeURIComponent(r.token)}`);
  } catch (e) {
    console.warn('[push] kayıt silinemedi', e);
  }
}

/** Bildirimdeki data.url → güvenli uygulama içi rota (yalnızca oturum türüne uygun bölüm) */
export function pushTarget(data: unknown, kind: PushKind): string | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;
  if (typeof url !== 'string' || url.length > 200) return null;
  const root = kind === 'staff' ? 'panel' : 'hesabim';
  return new RegExp(`^/${root}(?:/[A-Za-z0-9_-]+)*/?$`).test(url) ? url : null;
}
