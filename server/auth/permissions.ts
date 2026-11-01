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
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<'ADMIN' | 'DIETITIAN' | 'ASSISTANT', Permission[]> = {
  ADMIN: [...PERMISSIONS],
  DIETITIAN: PERMISSIONS.filter((p) => p !== 'users:manage'),
  // Asistan: randevu ve iletişim operasyonları; klinik verilere erişim yok
  ASSISTANT: ['dashboard:read', 'appointments:read', 'appointments:write', 'clients:read', 'clients:write'],
};
