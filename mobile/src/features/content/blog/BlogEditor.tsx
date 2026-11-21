// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme Rehberi yazı düzenleyici (web: BlogEditorPage.tsx). `id` yoksa yeni yazı oluşturur. */
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, confirm, ErrorView, Icon, Loading, Notice, Screen, SelectField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDateTime, slugify } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { POST_STATUS_LABEL } from '@shared/constants';
import { charCount, openSite, useUnsavedGuard } from '../FormBits';
import { ImageUpload } from '../ImageUpload';
import { SnippetPreview } from '../SeoForm';
import { MarkdownEditor } from './MarkdownEditor';
import { POST_TONE, readingMinutes, type Category, type Post } from './types';

type Draft = Omit<Post, 'id' | 'status' | 'publishedAt' | 'updatedAt'>;
const EMPTY: Draft = { slug: '', title: '', excerpt: '', content: '', coverImageUrl: null, coverImageAlt: null, categoryId: null, seoTitle: null, metaDescription: null, expertReviewed: false };
const pick = (p: Post): Draft => ({
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  content: p.content,
  coverImageUrl: p.coverImageUrl,
  coverImageAlt: p.coverImageAlt,
  categoryId: p.categoryId,
  seoTitle: p.seoTitle,
  metaDescription: p.metaDescription,
  expertReviewed: p.expertReviewed,
});

export function BlogEditorScreen({ id }: { id?: string }) {
  const cats = useApiQuery(['content', 'categories'], () => api.get<{ items: Category[] }>('/content/categories'));
  const post = useApiQuery(['content', 'post', id ?? 'yeni'], () => (id ? api.get<{ post: Post }>(`/content/posts/${id}`).then((r) => r.post) : Promise.resolve(null)), { staleTime: 0 });

  if (post.isPending || cats.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: id ? 'Yazıyı düzenle' : 'Yeni yazı' }} />
        <Loading />
      </>
    );
  }
  if (post.error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Yazı' }} />
        <ErrorView error={post.error.status === 404 ? new Error('Yazı bulunamadı veya silinmiş.') : post.error} onRetry={() => void post.refetch()} />
      </>
    );
  }
  return <Editor key={post.data?.id ?? 'new'} initial={post.data ?? null} categories={cats.data?.items ?? []} />;
}

function Editor({ initial, categories }: { initial: Post | null; categories: Category[] }) {
  const toast = useToast();
  const [post, setPost] = useState<Post | null>(initial);
  const [saved, setSaved] = useState<Draft>(initial ? pick(initial) : EMPTY);
  const [d, setD] = useState<Draft>(saved);
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish' | 'delete'>(null);
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(saved), [d, saved]);
  const disableGuard = useUnsavedGuard(dirty && busy === null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

  const payload = () => ({
    ...d,
    slug: d.slug || undefined,
    seoTitle: d.seoTitle?.trim() || null,
    metaDescription: d.metaDescription?.trim() || null,
    coverImageAlt: d.coverImageAlt?.trim() || null,
  });

  const afterChange = (p: Post) => {
    queryClient.setQueryData(['content', 'post', p.id], p);
    void queryClient.invalidateQueries({ queryKey: ['content', 'posts'] });
    void queryClient.invalidateQueries({ queryKey: ['content', 'categories'] });
  };

  /** Kaydeder; yeni yazıysa oluşturur. Başarılıysa güncel yazıyı döner. */
  const persist = async (): Promise<Post | null> => {
    setErrors({});
    try {
      const res = post ? await api.patch<{ post: Post }>(`/content/posts/${post.id}`, payload()) : await api.post<{ post: Post }>('/content/posts', payload());
      setPost(res.post);
      const nd = pick(res.post);
      setSaved(nd);
      setD(nd);
      setSlugTouched(true);
      afterChange(res.post);
      return res.post;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        toast('Kaydedilemedi — işaretli alanları kontrol edin.', 'error');
      } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
      return null;
    }
  };

  const save = async () => {
    setBusy('save');
    const p = await persist();
    if (p) toast(p.status === 'PUBLISHED' ? 'Değişiklikler yayında' : 'Taslak kaydedildi');
    setBusy(null);
  };

  const changeStatus = async (status: 'PUBLISHED' | 'UNPUBLISHED') => {
    if (status === 'PUBLISHED' && !d.expertReviewed) {
      setErrors((e) => ({ ...e, expertReviewed: 'Yayınlamak için uzman onayını işaretleyin.' }));
      toast('Yazı, uzman onayı işaretlenmeden yayınlanamaz.', 'error');
      return;
    }
    if (status === 'PUBLISHED' && !(await confirm({ title: 'Yazıyı yayınla', message: 'Yazı Beslenme Rehberi’nde herkese açık olarak görünecek.', confirmText: 'Yayınla' }))) return;
    if (status === 'UNPUBLISHED' && !(await confirm({ title: 'Yayından kaldır', message: 'Yazı web sitesinde artık görünmeyecek.', confirmText: 'Yayından kaldır', destructive: true }))) return;
    setBusy(status === 'PUBLISHED' ? 'publish' : 'unpublish');
    try {
      const p = dirty || !post ? await persist() : post;
      if (!p) return;
      const res = await api.post<{ post: Post }>(`/content/posts/${p.id}/status`, { status });
      setPost(res.post);
      afterChange(res.post);
      toast(status === 'PUBLISHED' ? 'Yazı yayınlandı' : 'Yazı yayından kaldırıldı');
    } catch (e) {
      toast(`İşlem tamamlanamadı: ${errorMessage(e)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!post) {
      router.back();
      return;
    }
    if (!(await confirm({ title: 'Yazıyı sil', message: `“${post.title}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`, confirmText: 'Kalıcı olarak sil', destructive: true }))) return;
    setBusy('delete');
    try {
      await api.del(`/content/posts/${post.id}`);
      toast('Yazı silindi');
      queryClient.removeQueries({ queryKey: ['content', 'post', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['content', 'posts'] });
      disableGuard();
      router.back();
    } catch (e) {
      toast(`Silinemedi: ${errorMessage(e)}`, 'error');
      setBusy(null);
    }
  };

  const status = post?.status ?? 'DRAFT';
  const publicPath = `/beslenme-rehberi/${d.slug || 'yazi-adresi'}`;
  const published = status === 'PUBLISHED';

  return (
    <>
      <Stack.Screen
        options={{
          title: post ? 'Yazıyı düzenle' : 'Yeni yazı',
          headerRight: published ? () => <Button title="Sitede gör" icon="external-link" variant="ghost" size="sm" onPress={() => openSite(`/beslenme-rehberi/${post!.slug}`)} /> : undefined,
        }}
      />
      <Screen
        footer={
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              title={published ? 'Değişiklikleri kaydet' : 'Taslak kaydet'}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void save()}
              loading={busy === 'save'}
              disabled={!!busy || (!dirty && !!post)}
            />
            {published ? (
              <Button title="Yayından kaldır" variant="secondary" style={{ flex: 1 }} onPress={() => void changeStatus('UNPUBLISHED')} loading={busy === 'unpublish'} disabled={!!busy} />
            ) : (
              <Button title="Yayınla" style={{ flex: 1 }} onPress={() => void changeStatus('PUBLISHED')} loading={busy === 'publish'} disabled={!!busy} />
            )}
          </View>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
          <Badge label={POST_STATUS_LABEL[status]} tone={POST_TONE[status]} />
          {post ? <T variant="caption">Son kayıt: {formatDateTime(post.updatedAt)}</T> : null}
          {dirty ? <T variant="caption" weight="semibold" color={colors.warningInk}>· Kaydedilmemiş değişiklikler</T> : null}
        </View>

        <Card style={{ gap: space.lg, marginBottom: space.lg }}>
          <TextField label="Başlık" required value={d.title} maxLength={160} error={errors.title} onChange={(v) => set('title', v)} style={{ fontSize: 18 }} />
          <TextField
            label="Adres (URL)"
            autoCapitalize="none"
            autoCorrect={false}
            help={`Sitede: ${publicPath}${published ? ' — yayındaki yazının adresini değiştirmek mevcut bağlantıları bozar.' : ''}`}
            value={d.slug}
            error={errors.slug}
            onChange={(v) => {
              setSlugTouched(true);
              set('slug', slugify(v));
            }}
          />
          <TextField
            label="Özet"
            rows={3}
            maxLength={400}
            value={d.excerpt}
            error={errors.excerpt}
            help={`Yazı listesinde ve paylaşımlarda görünür · ${charCount(d.excerpt, 400)}`}
            onChange={(v) => set('excerpt', v)}
          />
        </Card>

        <View style={{ marginBottom: space.lg }}>
          <T variant="label" style={{ marginBottom: 6 }}>İçerik</T>
          <MarkdownEditor value={d.content} onChange={(v) => set('content', v)} error={errors.content || undefined} />
        </View>

        <Card style={{ gap: space.md, marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="shield" size={17} color={colors.successInk} />
            <T variant="heading">Uzman onayı</T>
          </View>
          <T variant="caption">
            Beslenme içerikleri okuyucular tarafından tavsiye olarak algılanabilir. Bu nedenle bir yazı, içeriği bir uzman tarafından gözden geçirilip onaylanmadan yayınlanamaz.
          </T>
          <Pressable
            onPress={() => set('expertReviewed', !d.expertReviewed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: d.expertReviewed }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: d.expertReviewed ? colors.espresso : colors.mist,
                backgroundColor: d.expertReviewed ? colors.espresso : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {d.expertReviewed ? <Icon name="check" size={16} color={colors.cream} /> : null}
            </View>
            <T style={{ flex: 1 }}>İçerik uzman tarafından incelendi ve onaylandı</T>
          </Pressable>
          {errors.expertReviewed ? <T variant="caption" color={colors.dangerInk} accessibilityRole="alert">{errors.expertReviewed}</T> : null}
          {published && !d.expertReviewed ? <Notice tone="warning" text="Onay kaldırılıp kaydedilirse yazı yayından kaldırılır." /> : null}
        </Card>

        <Card style={{ gap: space.lg, marginBottom: space.lg }}>
          <SelectField<string>
            label="Kategori"
            value={d.categoryId ?? ''}
            onChange={(v) => set('categoryId', v || null)}
            placeholder="Kategori seçin"
            options={[{ value: '', label: 'Kategori yok' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <ImageUpload value={d.coverImageUrl} onChange={(v) => set('coverImageUrl', v)} label="Kapak görseli" alt={d.coverImageAlt} />
          <TextField
            label="Görsel açıklaması (alt metin)"
            help="Görme engelli okuyucular ve arama motorları için görseli kısaca tarif edin."
            value={d.coverImageAlt ?? ''}
            maxLength={200}
            error={errors.coverImageAlt}
            onChange={(v) => set('coverImageAlt', v)}
          />
        </Card>

        <Card style={{ gap: space.lg, marginBottom: space.lg }}>
          <T variant="heading">Arama motoru (SEO)</T>
          <TextField
            label="SEO başlığı"
            placeholder={d.title || 'Boşsa yazı başlığı kullanılır'}
            help={charCount(d.seoTitle ?? d.title, 70)}
            maxLength={70}
            value={d.seoTitle ?? ''}
            error={errors.seoTitle}
            onChange={(v) => set('seoTitle', v)}
          />
          <TextField
            label="Meta açıklaması"
            rows={3}
            placeholder={d.excerpt || 'Boşsa özet kullanılır'}
            help={charCount(d.metaDescription ?? d.excerpt, 170)}
            maxLength={170}
            value={d.metaDescription ?? ''}
            error={errors.metaDescription}
            onChange={(v) => set('metaDescription', v)}
          />
          <SnippetPreview title={d.seoTitle || d.title} description={d.metaDescription || d.excerpt} path={publicPath} />
          <T variant="caption">Tahmini okuma süresi: {readingMinutes(d.content)} dk</T>
        </Card>

        <Button
          title={post ? 'Yazıyı sil' : 'Vazgeç'}
          icon={post ? 'trash-2' : 'x'}
          variant="danger"
          full
          onPress={() => void remove()}
          loading={busy === 'delete'}
          disabled={!!busy && busy !== 'delete'}
        />
      </Screen>
    </>
  );
}
