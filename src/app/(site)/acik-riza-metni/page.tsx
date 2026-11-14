// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/LegalPage';

export const generateMetadata = () => pageMetadata('/acik-riza-metni');

export default function Route() {
  return (
    <>
      <SeoJsonLd path="/acik-riza-metni" />
      <Page doc="consent" />
    </>
  );
}
