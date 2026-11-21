// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Fotoğraf arşivinden görsel seçimi (yükleme için) */
import * as ImagePicker from 'expo-image-picker';
import type { UploadFile } from '@/lib/api';

/**
 * Görsel seçtirir; vazgeçilirse null. `maxBytes` aşılırsa hata fırlatır.
 * quality < 1 olduğundan iOS HEIC fotoğrafları JPEG olarak döner (sunucu HEIC kabul etmez).
 */
export async function pickImage(maxBytes: number): Promise<UploadFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Fotoğraflara erişim izni verilmedi. Ayarlar’dan izin verebilirsiniz.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false, exif: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  if (a.fileSize && a.fileSize > maxBytes) throw new Error(`Dosya çok büyük. En fazla ${Math.round(maxBytes / 1024 / 1024)} MB yükleyebilirsiniz.`);
  let type = a.mimeType ?? 'image/jpeg';
  if (/heic|heif/i.test(type)) type = 'image/jpeg';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const base = (a.fileName ?? 'gorsel').replace(/\.[a-z0-9]+$/i, '');
  return { uri: a.uri, name: `${base}.${ext}`, type };
}
