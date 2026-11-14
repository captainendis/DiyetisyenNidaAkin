// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tüm /api istekleri Hono uygulamasına (server/app.ts) gider */
import { api } from '../../../../server/app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handle = (req: Request) => api.fetch(req);
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD, handle as OPTIONS };
