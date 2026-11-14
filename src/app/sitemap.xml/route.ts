// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { buildSitemap } from '../../../server/seo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(await buildSitemap(), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
