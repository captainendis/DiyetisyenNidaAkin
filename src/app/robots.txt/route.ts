// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { robotsTxt } from '../../../server/seo';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(robotsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
