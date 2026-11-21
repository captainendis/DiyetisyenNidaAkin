// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme Rehberi yazıları: arama, durum ve kategori filtresi, sayfalama (web: BlogList.tsx) */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, Card, Chips, Empty, Fab, Icon, Loading, ErrorView, Screen, SelectField, T, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { POST_STATUS_LABEL, POST_STATUSES, type PostStatus } from '@shared/constants';
import { Pager, useDebounced } from '../FormBits';
import { absUrl } from '../ImageUpload';
import { POST_TONE, type Category, type PostRow } from './types';

const PAGE_SIZE = 15;

export function BlogList() {
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const cats = useApiQuery(['content', 'categories'], () => api.get<{ items: Category[] }>('/content/categories'));
  const posts = useApiQuery(['content', 'posts', { status, categoryId, dq, page }], () =>
    api.get<{ items: PostRow[]; total: number; pageSize: number }>('/content/posts', { status, categoryId, q: dq, page, pageSize: PAGE_SIZE }),
  );
  const filtered = !!(status || categoryId || dq);
  const newPost = () => router.push('/panel/blog/yeni');

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={posts.refreshing} onRefresh={posts.refresh} contentStyle={{ paddingBottom: 100 }}>
        <View style={{ gap: space.md, marginBottom: space.lg }}>
          <TextField value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Başlık veya özette ara" icon="search" autoCorrect={false} accessibilityLabel="Yazılarda ara" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: space.lg }}>
            <Chips<string>
              value={status}
              onChange={(v) => {
                setStatus(v as PostStatus | '');
                setPage(1);
              }}
              options={[{ value: '', label: 'Tümü' }, ...POST_STATUSES.map((s) => ({ value: s, label: POST_STATUS_LABEL[s] }))]}
            />
          </ScrollView>
          <SelectField<string>
            value={categoryId}
            onChange={(v) => (setCategoryId(v), setPage(1))}
            placeholder="Tüm kategoriler"
            options={[{ value: '', label: 'Tüm kategoriler' }, ...(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name, description: c._count ? `${c._count.posts} yazı` : undefined }))]}
          />
        </View>
        {posts.isPending ? (
          <Loading />
        ) : posts.error || !posts.data ? (
          <ErrorView error={posts.error} onRetry={() => void posts.refetch()} />
        ) : !posts.data.items.length ? (
          filtered ? (
            <Empty icon="search" title="Eşleşen yazı yok" text="Filtreleri değiştirerek tekrar deneyin." />
          ) : (
            <Empty
              icon="file-text"
              title="Henüz yazı yok"
              text="Beslenme Rehberi’nde yayınlanacak ilk yazınızı oluşturun. Yazılar uzman onayı verilmeden yayınlanmaz."
              action={<Button title="Yeni yazı" icon="plus" onPress={newPost} />}
            />
          )
        ) : (
          <>
            <View style={{ gap: space.md }}>
              {posts.data.items.map((r) => (
                <Card key={r.id} onPress={() => router.push(`/panel/blog/${r.id}`)} padded={false}>
                  <View style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
                    {r.coverImageUrl ? (
                      <Image source={{ uri: absUrl(r.coverImageUrl) }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="file-text" size={22} color={colors.mist} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                      <T variant="subheading" numberOfLines={2}>{r.title}</T>
                      <T variant="caption" numberOfLines={1}>/beslenme-rehberi/{r.slug}</T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Badge label={POST_STATUS_LABEL[r.status]} tone={POST_TONE[r.status]} />
                        {r.expertReviewed ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} accessibilityLabel="Uzman onaylı">
                            <Icon name="shield" size={13} color={colors.successInk} />
                            <T variant="caption" color={colors.successInk}>Onaylı</T>
                          </View>
                        ) : null}
                      </View>
                      <T variant="caption">
                        {r.category?.name ? `${r.category.name} · ` : ''}
                        {formatDate(r.updatedAt)}
                      </T>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
            <Pager page={page} pageSize={posts.data.pageSize} total={posts.data.total} onChange={setPage} />
          </>
        )}
      </Screen>
      <Fab label="Yeni yazı" icon="plus" onPress={newPost} />
    </View>
  );
}
