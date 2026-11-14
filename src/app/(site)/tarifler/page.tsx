// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/RecipesListPage';

export const generateMetadata = () => pageMetadata('/tarifler');

export default function Route() {
  return (
    <>
      <SeoJsonLd path="/tarifler" />
      <Page />
    </>
  );
}
