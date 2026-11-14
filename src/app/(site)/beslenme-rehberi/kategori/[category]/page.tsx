// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { pageMetadata, SeoJsonLd } from '@/app/_lib/seo';
import Page from '@/views/BlogListPage';

type Props = { params: Promise<{ category: string }> };
const pathOf = async ({ params }: Props) => {
  const { category } = await params;
  return `/beslenme-rehberi/kategori/${category}`;
};

export async function generateMetadata(props: Props) {
  return pageMetadata(await pathOf(props));
}

export default async function Route(props: Props) {
  return (
    <>
      <SeoJsonLd path={await pathOf(props)} />
      <Page />
    </>
  );
}
