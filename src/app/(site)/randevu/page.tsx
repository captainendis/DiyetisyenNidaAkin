// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/AppointmentPage';

export const generateMetadata = () => pageMetadata('/randevu');

export default function Route() {
  return (
    <>
      <SeoJsonLd path="/randevu" />
      <Page />
    </>
  );
}
