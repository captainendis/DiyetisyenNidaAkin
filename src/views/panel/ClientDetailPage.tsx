// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from '@/lib/router';
import { ArrowLeft, CalendarPlus, Download, Lock, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatPhone } from '@/lib/format';
import { CLIENT_STATUS_LABEL } from '@shared/constants';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/panel/ui';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { ClientFormModal } from '@/components/panel/clients/ClientFormModal';
import { DeleteClientDialog } from '@/components/panel/clients/DeleteClientDialog';
import { OverviewTab } from '@/components/panel/clients/OverviewTab';
import { AppointmentsTab } from '@/components/panel/clients/AppointmentsTab';
import { NotesTab } from '@/components/panel/clients/NotesTab';
import { ClientMessagesTab } from '@/components/panel/clients/ClientMessagesTab';
import { MeasurementsTab } from '@/components/panel/clients/MeasurementsTab';
import { FilesTab } from '@/components/panel/clients/FilesTab';
import { ClientPlansTab } from '@/components/panel/plans/ClientPlansTab';
import { CLIENT_STATUS_TONE, type Client, type ClientStats } from '@/components/panel/clients/types';

type Tab = 'genel' | 'randevular' | 'notlar' | 'mesajlar' | 'planlar' | 'takip' | 'dosyalar';

function ClinicalLocked() {
  return (
    <Card>
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="Bu bölüm klinik yetki gerektirir"
        description="Görüşme notları, ölçümler ve sağlık belgeleri özel nitelikli kişisel veri olabileceğinden yalnızca diyetisyen ve yönetici rollerine açıktır."
      />
    </Card>
  );
}

function Detail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { can } = usePanelAuth();
  const tab = (params.get('sekme') as Tab) || 'genel';
  const setTab = (t: Tab) => {
    params.set('sekme', t);
    setParams(params, { replace: true });
  };
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, error, loading, reload, setData } = useApi(() => api.get<{ client: Client; stats: ClientStats }>(`/clients/${id}`), [id]);
  const updateClient = (c: Client) => setData((d) => (d ? { ...d, client: c } : d));

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4"><Skeleton className="h-14 w-14 rounded-full" /><Skeleton className="h-9 w-64" /></div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        {error?.status === 404 ? (
          <EmptyState title="Danışan bulunamadı" description="Kayıt silinmiş veya bağlantı hatalı olabilir." action={<Link to="/panel/danisanlar"><Button variant="secondary">Danışan listesine dön</Button></Link>} />
        ) : (
          <ErrorState message={error?.message} onRetry={reload} />
        )}
      </Card>
    );
  }

  const { client, stats } = data;
  const name = `${client.firstName} ${client.lastName}`;
  const clinical = can('clinical:read');

  return (
    <>
      <Link to="/panel/danisanlar" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-panel-muted hover:text-cocoa">
        <ArrowLeft className="h-4 w-4" /> Danışanlar
      </Link>
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} className="h-14 w-14 text-base" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[2rem] leading-tight font-medium text-espresso sm:text-[2.4rem]">{name}</h1>
              <Badge tone={CLIENT_STATUS_TONE[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cocoa">
              <a href={`tel:${client.phone}`} className="tabular inline-flex items-center gap-1.5 hover:underline"><Phone className="h-3.5 w-3.5 text-panel-muted" />{formatPhone(client.phone)}</a>
              {client.email && <a href={`mailto:${client.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5 text-panel-muted" /><span className="truncate">{client.email}</span></a>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('appointments:write') && (
            <Link to={`/panel/randevular?new=1&clientId=${client.id}`}><Button icon={<CalendarPlus className="h-4 w-4" />}>Yeni randevu</Button></Link>
          )}
          {can('clients:write') && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Düzenle</Button>}
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download(`/clients/${client.id}/export`)} title="KVKK md. 11 kapsamındaki bilgi talepleri için tüm kayıtları JSON olarak indirir">
            Veri dışa aktar
          </Button>
          {can('clients:delete') && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(true)} className="text-danger-ink hover:bg-danger/10">Sil</Button>}
        </div>
      </header>

      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'genel', label: 'Genel Bakış' },
          { value: 'randevular', label: 'Randevu Geçmişi' },
          { value: 'notlar', label: <span className="flex items-center gap-1.5">Görüşme Notları{!clinical && <Lock className="h-3 w-3" />}</span> },
          { value: 'mesajlar', label: <span className="flex items-center gap-1.5">Danışana Mesajlar{!clinical && <Lock className="h-3 w-3" />}</span> },
          { value: 'planlar', label: <span className="flex items-center gap-1.5">Beslenme Planları{!clinical && <Lock className="h-3 w-3" />}</span> },
          { value: 'takip', label: <span className="flex items-center gap-1.5">Beslenme Takibi{!clinical && <Lock className="h-3 w-3" />}</span> },
          { value: 'dosyalar', label: <span className="flex items-center gap-1.5">Dosyalar{!clinical && <Lock className="h-3 w-3" />}</span> },
        ]}
      />

      <div role="tabpanel">
        {tab === 'genel' && <OverviewTab client={client} stats={stats} onClientChanged={updateClient} />}
        {tab === 'randevular' && <AppointmentsTab clientId={client.id} />}
        {tab === 'notlar' && (clinical ? <NotesTab clientId={client.id} /> : <ClinicalLocked />)}
        {tab === 'mesajlar' && (clinical ? <ClientMessagesTab clientId={client.id} /> : <ClinicalLocked />)}
        {tab === 'planlar' && (clinical ? <ClientPlansTab clientId={client.id} clientName={`${client.firstName} ${client.lastName}`} /> : <ClinicalLocked />)}
        {tab === 'takip' && (clinical ? <MeasurementsTab client={client} onClientChanged={updateClient} /> : <ClinicalLocked />)}
        {tab === 'dosyalar' && (clinical ? <FilesTab client={client} onClientChanged={updateClient} /> : <ClinicalLocked />)}
      </div>

      <ClientFormModal open={editing} client={client} onClose={() => setEditing(false)} onSaved={(c) => { updateClient(c); setEditing(false); }} />
      <DeleteClientDialog client={client} open={deleting} onClose={() => setDeleting(false)} onDeleted={() => navigate('/panel/danisanlar', { replace: true })} />
    </>
  );
}

export default function ClientDetailPage() {
  return (
    <RequirePermission perm="clients:read">
      <Detail />
    </RequirePermission>
  );
}
