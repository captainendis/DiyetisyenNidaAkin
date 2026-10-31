/** Beslenme Rehberi yazı düzenleyici — /panel/icerikler/blog/:id ('yeni' = oluştur) */
import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, Checkbox, ErrorState, Input, Select, Skeleton, Textarea, useFeedback } from '@/components/panel/ui';
import { MarkdownEditor } from '@/components/panel/content/MarkdownEditor';
import { ImageUpload } from '@/components/panel/content/ImageUpload';
import { SnippetPreview } from '@/components/panel/content/SnippetPreview';
import { CharCount, Notice } from '@/components/panel/content/FormBits';
import { POST_TONE } from '@/components/panel/content/BlogList';
import { POST_STATUS_LABEL, type PostStatus } from '@shared/constants';
import { formatDateTime, slugify } from '@/lib/format';
import { readingMinutes } from '@/lib/markdown';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  categoryId: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  expertReviewed: boolean;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
}

type Draft = Omit<Post, 'id' | 'status' | 'publishedAt' | 'updatedAt'>;
const EMPTY: Draft = { slug: '', title: '', excerpt: '', content: '', coverImageUrl: null, coverImageAlt: null, categoryId: null, seoTitle: null, metaDescription: null, expertReviewed: false };
const pick = (p: Post): Draft => ({
  slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.content, coverImageUrl: p.coverImageUrl, coverImageAlt: p.coverImageAlt,
  categoryId: p.categoryId, seoTitle: p.seoTitle, metaDescription: p.metaDescription, expertReviewed: p.expertReviewed,
});

function Editor({ initial, categories }: { initial: Post | null; categories: { id: string; name: string }[] }) {
  const navigate = useNavigate();
  const fb = useFeedback();
  const [post, setPost] = useState<Post | null>(initial);
  const [saved, setSaved] = useState<Draft>(initial ? pick(initial) : EMPTY);
  const [d, setD] = useState<Draft>(saved);
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish' | 'delete'>(null);
  const dirty = useMemo(() => JSON.stringify(d) !== JSON.stringify(saved), [d, saved]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  // Kaydedilmemiş değişiklik koruması
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && busy === null && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void fb
      .confirm({ title: 'Kaydedilmemiş değişiklikler', description: 'Sayfadan ayrılırsanız yaptığınız değişiklikler kaybolacak.', confirmLabel: 'Ayrıl', cancelLabel: 'Sayfada kal', tone: 'danger' })
      .then((ok) => (ok ? blocker.proceed() : blocker.reset()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  const payload = () => ({
    ...d,
    slug: d.slug || undefined,
    seoTitle: d.seoTitle?.trim() || null,
    metaDescription: d.metaDescription?.trim() || null,
    coverImageAlt: d.coverImageAlt?.trim() || null,
  });

  /** Kaydeder; yeni yazıysa oluşturur. Başarılıysa güncel yazıyı döner. */
  const persist = async (): Promise<Post | null> => {
    setErrors({});
    try {
      const res = post ? await api.patch<{ post: Post }>(`/content/posts/${post.id}`, payload()) : await api.post<{ post: Post }>('/content/posts', payload());
      setPost(res.post);
      const nd = pick(res.post);
      setSaved(nd);
      setD(nd);
      if (!post) navigate(`/panel/icerikler/blog/${res.post.id}`, { replace: true });
      return res.post;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        fb.error('Kaydedilemedi', 'İşaretli alanları kontrol edin.');
      } else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
      return null;
    }
  };

  const save = async () => {
    setBusy('save');
    const p = await persist();
    if (p) fb.success(p.status === 'PUBLISHED' ? 'Değişiklikler yayında' : 'Taslak kaydedildi');
    setBusy(null);
  };

  const changeStatus = async (status: 'PUBLISHED' | 'UNPUBLISHED') => {
    if (status === 'PUBLISHED' && !d.expertReviewed) {
      setErrors((e) => ({ ...e, expertReviewed: 'Yayınlamak için uzman onayını işaretleyin.' }));
      fb.error('Yayınlanamadı', 'Yazı, uzman onayı işaretlenmeden yayınlanamaz.');
      return;
    }
    if (status === 'PUBLISHED' && !(await fb.confirm({ title: 'Yazıyı yayınla', description: 'Yazı Beslenme Rehberi’nde herkese açık olarak görünecek.', confirmLabel: 'Yayınla' }))) return;
    setBusy(status === 'PUBLISHED' ? 'publish' : 'unpublish');
    try {
      const p = dirty || !post ? await persist() : post;
      if (!p) return;
      const res = await api.post<{ post: Post }>(`/content/posts/${p.id}/status`, { status });
      setPost(res.post);
      fb.success(status === 'PUBLISHED' ? 'Yazı yayınlandı' : 'Yazı yayından kaldırıldı');
    } catch (e) {
      fb.error('İşlem tamamlanamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!post) return navigate('/panel/icerikler?sekme=blog');
    if (!(await fb.confirm({ title: 'Yazıyı sil', description: `“${post.title}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`, confirmLabel: 'Kalıcı olarak sil', tone: 'danger' }))) return;
    setBusy('delete');
    try {
      await api.del(`/content/posts/${post.id}`);
      fb.success('Yazı silindi');
      navigate('/panel/icerikler?sekme=blog');
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
      setBusy(null);
    }
  };

  const status = post?.status ?? 'DRAFT';
  const publicPath = `/beslenme-rehberi/${d.slug || 'yazi-adresi'}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/panel/icerikler?sekme=blog" className="mb-2 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-panel-muted hover:text-cocoa">
            <ArrowLeft className="h-4 w-4" /> Beslenme Rehberi
          </Link>
          <h1 className="font-display text-[2rem] leading-tight font-medium text-espresso sm:text-[2.4rem]">{post ? 'Yazıyı düzenle' : 'Yeni yazı'}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.8rem] text-panel-muted">
            <Badge tone={POST_TONE[status]}>{POST_STATUS_LABEL[status]}</Badge>
            {post && <span>Son kayıt: {formatDateTime(post.updatedAt)}</span>}
            {dirty && <span className="font-semibold text-[#7d5720]">· Kaydedilmemiş değişiklikler</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'PUBLISHED' && (
            <a href={publicPath} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-cocoa hover:underline">
              Sitede gör <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <Button variant="secondary" onClick={() => void save()} loading={busy === 'save'} disabled={!!busy || (!dirty && !!post)}>
            {status === 'PUBLISHED' ? 'Değişiklikleri kaydet' : 'Taslak kaydet'}
          </Button>
          {status === 'PUBLISHED' ? (
            <Button variant="secondary" onClick={() => void changeStatus('UNPUBLISHED')} loading={busy === 'unpublish'} disabled={!!busy}>
              Yayından kaldır
            </Button>
          ) : (
            <Button onClick={() => void changeStatus('PUBLISHED')} loading={busy === 'publish'} disabled={!!busy}>
              Yayınla
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Card className="space-y-4 p-5">
            <Input
              label="Başlık"
              required
              value={d.title}
              maxLength={160}
              error={errors.title}
              onChange={(e) => set('title', e.target.value)}
              className="h-12 font-display text-[1.35rem]"
            />
            <Input
              label="Adres (URL)"
              hint={<span>Sitede: <span className="font-mono">{publicPath}</span>{status === 'PUBLISHED' && ' — yayındaki yazının adresini değiştirmek mevcut bağlantıları bozar.'}</span>}
              value={d.slug}
              error={errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', slugify(e.target.value));
              }}
            />
            <Textarea
              label="Özet"
              rows={2}
              maxLength={400}
              value={d.excerpt}
              error={errors.excerpt}
              hint={<span>Yazı listesinde ve paylaşımlarda görünür · <CharCount value={d.excerpt} max={400} /></span>}
              onChange={(e) => set('excerpt', e.target.value)}
            />
          </Card>
          <MarkdownEditor value={d.content} onChange={(v) => set('content', v)} error={errors.content} />
        </div>

        <aside className="space-y-5">
          <Card className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-[0.9rem] font-bold text-espresso">
              <ShieldCheck className="h-4 w-4 text-success" /> Uzman onayı
            </h2>
            <p className="text-[0.8rem] leading-relaxed text-panel-muted">
              Beslenme içerikleri okuyucular tarafından tavsiye olarak algılanabilir. Bu nedenle bir yazı, içeriği bir uzman tarafından gözden geçirilip onaylanmadan yayınlanamaz.
            </p>
            <Checkbox
              label="İçerik uzman tarafından incelendi ve onaylandı"
              checked={d.expertReviewed}
              onChange={(e) => set('expertReviewed', e.target.checked)}
            />
            {errors.expertReviewed && <p className="text-[0.78rem] text-danger" role="alert">{errors.expertReviewed}</p>}
            {status === 'PUBLISHED' && !d.expertReviewed && <Notice tone="warning">Onay kaldırılıp kaydedilirse yazı yayından kaldırılır.</Notice>}
          </Card>

          <Card className="space-y-4 p-5">
            <Select
              label="Kategori"
              value={d.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value || null)}
              placeholder="Kategori seçin"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <ImageUpload value={d.coverImageUrl} onChange={(v) => set('coverImageUrl', v)} label="Kapak görseli" />
            <Input
              label="Görsel açıklaması (alt metin)"
              hint="Görme engelli okuyucular ve arama motorları için görseli kısaca tarif edin."
              value={d.coverImageAlt ?? ''}
              maxLength={200}
              error={errors.coverImageAlt}
              onChange={(e) => set('coverImageAlt', e.target.value)}
            />
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-[0.9rem] font-bold text-espresso">Arama motoru (SEO)</h2>
            <Input label="SEO başlığı" placeholder={d.title || 'Boşsa yazı başlığı kullanılır'} hint={<CharCount value={d.seoTitle ?? d.title} max={70} />} maxLength={70} value={d.seoTitle ?? ''} error={errors.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
            <Textarea label="Meta açıklaması" rows={3} placeholder={d.excerpt || 'Boşsa özet kullanılır'} hint={<CharCount value={d.metaDescription ?? d.excerpt} max={170} />} maxLength={170} value={d.metaDescription ?? ''} error={errors.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
            <SnippetPreview title={d.seoTitle || d.title} description={d.metaDescription || d.excerpt} path={publicPath} />
            <p className="text-[0.75rem] text-panel-muted">Tahmini okuma süresi: {readingMinutes(d.content)} dk</p>
          </Card>

          <Button variant="ghost" className="w-full text-danger hover:bg-danger/10" icon={<Trash2 className="h-4 w-4" />} onClick={() => void remove()} loading={busy === 'delete'} disabled={!!busy && busy !== 'delete'}>
            {post ? 'Yazıyı sil' : 'Vazgeç'}
          </Button>
        </aside>
      </div>
    </>
  );
}

export default function BlogEditorPage() {
  const { id } = useParams();
  const isNew = id === 'yeni';
  const cats = useApi(() => api.get<{ items: { id: string; name: string }[] }>('/content/categories'), []);
  const post = useApi(() => (isNew ? Promise.resolve(null) : api.get<{ post: Post }>(`/content/posts/${id}`).then((r) => r.post)), [id]);

  return (
    <RequirePermission perm="content:write">
      {post.loading || cats.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-[32rem] w-full rounded-xl" />
        </div>
      ) : post.error ? (
        <ErrorState message={post.error.status === 404 ? 'Yazı bulunamadı veya silinmiş.' : post.error.message} onRetry={post.reload} />
      ) : (
        <Editor key={id === 'yeni' ? 'new' : post.data?.id} initial={post.data} categories={cats.data?.items ?? []} />
      )}
    </RequirePermission>
  );
}
