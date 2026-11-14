// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/ContactPage';

export const generateMetadata = () => pageMetadata('/iletisim');

export default function Route() {
  return (
    <>
      <SeoJsonLd path="/iletisim" />
      <Page />
    </>
  );
}
