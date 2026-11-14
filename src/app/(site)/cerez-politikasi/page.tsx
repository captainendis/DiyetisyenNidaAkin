// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/LegalPage';

export const generateMetadata = () => pageMetadata('/cerez-politikasi');

export default function Route() {
  return (
    <>
      <SeoJsonLd path="/cerez-politikasi" />
      <Page doc="cookies" />
    </>
  );
}
