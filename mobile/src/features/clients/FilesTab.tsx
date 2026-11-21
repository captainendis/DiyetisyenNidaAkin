// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan dosyaları (tahlil, belge) — yükleme, indirme/paylaşma, danışanla paylaşma, silme */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Badge, Button, Card, Empty, Icon, IconButton, Notice, QueryView, T, confirm, useToast } from '@/components/ui';
import { api, errorMessage, type UploadFile } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { ConsentGate } from './Consent';
import { clientKeys, type Client, type ClientFile } from './types';

type Res = { items: ClientFile[] };
const MAX = 10 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

type Picked = UploadFile & { size?: number };

export function FilesTab({ client, onClientChanged }: { client: Client; onClientChanged: (c: Client) => void }) {
  const { can } = useStaff();
  const writable = can('clinical:write');
  const consent = !!client.healthConsentAt;
  const key = clientKeys.sub(client.id, 'files');
  const q = useApiQuery(key, () => api.get<Res>(`/clients/${client.id}/files`));
  const setItems = (fn: (items: ClientFile[]) => ClientFile[]) => queryClient.setQueryData<Res>(key, (d) => ({ items: fn(d?.items ?? []) }));
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  async function upload(files: Picked[]) {
    for (const file of files) {
      if (file.size != null && file.size > MAX) {
        toast(`${file.name} yüklenemedi: dosya en fazla 10 MB olabilir.`, 'error');
        continue;
      }
      setUploading(file.name);
      try {
        const res = await api.upload<{ file: ClientFile }>(`/clients/${client.id}/files`, { uri: file.uri, name: file.name, type: file.type });
        setItems((items) => [res.file, ...items]);
        toast(`Dosya yüklendi: ${file.name}`);
      } catch (e) {
        toast(`${file.name} yüklenemedi: ${errorMessage(e)}`, 'error');
      }
    }
    setUploading(null);
  }

  async function pickDocument() {
    const r = await DocumentPicker.getDocumentAsync({ type: TYPES, multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    await upload(r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size })));
  }

  async function pickImage(camera: boolean) {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast('Kamera izni verilmedi. Ayarlar’dan izin verebilirsiniz.', 'error');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: !camera };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    await upload(
      r.assets.map((a, i) => {
        const type = a.mimeType && TYPES.includes(a.mimeType) ? a.mimeType : 'image/jpeg';
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
        return { uri: a.uri, name: a.fileName || `fotograf-${Date.now()}-${i + 1}.${ext}`, type, size: a.fileSize };
      }),
    );
  }

  async function download(f: ClientFile) {
    setBusy(f.id);
    try {
      await api.download(`/clients/${client.id}/files/${f.id}/download`, f.originalName);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function toggleVisible(f: ClientFile) {
    try {
      await api.patch(`/clients/${client.id}/files/${f.id}/visibility`, { visibleToClient: !f.visibleToClient });
      setItems((items) => items.map((x) => (x.id === f.id ? { ...x, visibleToClient: !f.visibleToClient } : x)));
      toast(f.visibleToClient ? 'Dosya danışandan gizlendi' : 'Dosya danışanla paylaşıldı');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function remove(f: ClientFile) {
    if (!(await confirm({ title: 'Dosya silinsin mi?', message: `"${f.originalName}" kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true }))) return;
    try {
      await api.del(`/clients/${client.id}/files/${f.id}`);
      setItems((items) => items.filter((x) => x.id !== f.id));
      toast('Dosya silindi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      {!consent ? <ConsentGate client={client} onChanged={onClientChanged} what="sağlık belgeleri" /> : null}
      {consent && writable ? (
        <Card style={{ alignItems: 'center', gap: space.sm, borderStyle: 'dashed', borderWidth: 1.5 }}>
          <Icon name="upload-cloud" size={26} color={colors.goldInk} />
          <T variant="subheading" center>{uploading ? `Yükleniyor: ${uploading}` : 'Dosya yükle'}</T>
          <T variant="caption" center>PDF, JPG, PNG veya WEBP · en fazla 10 MB · şifreli saklanır</T>
          {uploading ? <ActivityIndicator color={colors.gold} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.xs }}>
            <Button title="Dosya seç" icon="file-plus" size="sm" disabled={!!uploading} onPress={() => void pickDocument().catch((e) => toast(errorMessage(e), 'error'))} />
            <Button title="Galeri" icon="image" size="sm" variant="secondary" disabled={!!uploading} onPress={() => void pickImage(false).catch((e) => toast(errorMessage(e), 'error'))} />
            <Button title="Kamera" icon="camera" size="sm" variant="secondary" disabled={!!uploading} onPress={() => void pickImage(true).catch((e) => toast(errorMessage(e), 'error'))} />
          </View>
        </Card>
      ) : null}
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Card>
              <Empty
                icon="file-text"
                title="Henüz dosya yok."
                text={consent ? 'Tahlil sonuçları veya danışanın paylaştığı belgeler burada saklanabilir.' : 'Açık rıza kaydedildikten sonra dosya yüklenebilir.'}
              />
            </Card>
          ) : (
            <Card padded={false}>
              {data.items.map((f, i) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderBottomWidth: i === data.items.length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={f.mimeType === 'application/pdf' ? 'file-text' : 'image'} size={17} color={colors.muted} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T variant="subheading" numberOfLines={2}>{f.originalName}</T>
                    <Badge label={f.visibleToClient ? 'Danışan görür' : 'Gizli'} tone={f.visibleToClient ? 'success' : 'neutral'} />
                    <T variant="caption">
                      {size(f.sizeBytes)} · {formatDateTime(f.createdAt)}
                      {f.uploadedBy ? ` · ${f.uploadedBy.firstName} ${f.uploadedBy.lastName}` : ''}
                    </T>
                  </View>
                  <View style={{ gap: 2 }}>
                    {busy === f.id ? (
                      <ActivityIndicator color={colors.gold} style={{ padding: 6 }} />
                    ) : (
                      <IconButton name="download" label={`${f.originalName} indir`} onPress={() => void download(f)} color={colors.goldInk} />
                    )}
                    {writable ? (
                      <IconButton
                        name={f.visibleToClient ? 'eye-off' : 'eye'}
                        label={f.visibleToClient ? `${f.originalName} danışandan gizle` : `${f.originalName} danışanla paylaş`}
                        onPress={() => void toggleVisible(f)}
                        color={colors.muted}
                      />
                    ) : null}
                    {writable ? <IconButton name="trash-2" label={`${f.originalName} sil`} onPress={() => void remove(f)} color={colors.dangerInk} /> : null}
                  </View>
                </View>
              ))}
            </Card>
          )
        }
      </QueryView>
      <Notice
        tone="neutral"
        icon="lock"
        text="Dosyalar sunucuda şifrelenmiş olarak saklanır ve her indirme kayıt altına alınır. “Danışan görür” işaretli dosyaları danışan kendi hesabından indirebilir; göz simgesiyle gizleyebilirsiniz."
      />
    </View>
  );
}
