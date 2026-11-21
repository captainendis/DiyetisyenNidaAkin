// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Rol tabanlı erişim. Hassas sağlık verilerine (klinik notlar, ölçümler, dosyalar)
 * yalnızca "clinical:*" iznine sahip roller erişebilir.
 */
export const PERMISSIONS = [
  'dashboard:read',
  'appointments:read',
  'appointments:write',
  'clients:read',
  'clients:write',
  'clients:delete',
  'clinical:read',
  'clinical:write',
  'services:write',
  'content:write',
  'availability:write',
  'reports:read',
  'settings:write',
  'users:manage',
  'audit:read',
  /** Danışan hesabı (Hesabım) açma, bağlantı üretme, kapatma — yalnızca yönetici */
  'portal:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<'ADMIN' | 'DIETITIAN' | 'ASSISTANT' | 'REVIEWER', Permission[]> = {
  ADMIN: [...PERMISSIONS],
  DIETITIAN: PERMISSIONS.filter((p) => p !== 'users:manage' && p !== 'portal:manage'),
  // Asistan: randevu ve iletişim operasyonları; klinik verilere erişim yok
  ASSISTANT: ['dashboard:read', 'appointments:read', 'appointments:write', 'clients:read', 'clients:write'],
  // Mağaza incelemesi: yalnızca okuma; veriler server/auth/reviewer.ts ile demo danışanlarla sınırlanır
  REVIEWER: ['dashboard:read', 'appointments:read', 'clients:read', 'clinical:read'],
};
