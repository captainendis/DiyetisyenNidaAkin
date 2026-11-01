// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSearchParams } from 'react-router';
import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { BookingForm } from '@/components/forms/BookingForm';
import { Seo } from '@/components/seo/Seo';
import { useSiteImages } from '@/config/media';
import { Picture } from '@/components/sections/Picture';

export default function AppointmentPage() {
  const images = useSiteImages();
  const { site } = useSite();
  const [params] = useSearchParams();
  const crumbs = [{ name: 'Randevu', path: '/randevu' }];
  const serviceSlug = params.get('hizmet');
  const serviceId = site.services.find((s) => s.slug === serviceSlug)?.id ?? null;
  return (
    <>
      <Seo title="Randevu Talebi" description="Diyetisyen Nida Akın ile görüşmek için çevrim içi randevu talebi oluşturun." breadcrumbs={crumbs} />
      <PageHeader title="Randevu talebi" crumbs={crumbs} lead={site.settings.appointment.formNote} />
      <section className="bg-ivory text-espresso">
        <div className="container-edge grid gap-14 py-16 sm:py-24 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-8">
            <BookingForm key={serviceId ?? 'none'} variant="page" initialServiceId={serviceId} />
          </div>
          <aside className="hidden lg:col-span-3 lg:col-start-10 lg:block">
            <div className="sticky top-28">
              <Picture {...images.venue} sizes="25vw" imgClassName="aspect-[4/5] w-full object-cover" />
              <p className="mt-5 text-[0.85rem] leading-relaxed text-taupe">
                Talebiniz kesinleşmiş bir randevu değildir. Uygunluk kontrolünden sonra sizinle iletişime geçilerek randevunuz onaylanır.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
