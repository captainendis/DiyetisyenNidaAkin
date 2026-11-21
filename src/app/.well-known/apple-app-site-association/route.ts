// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** iOS Universal Links — bkz. ../app-links.ts */
import { appleAppSiteAssociation, jsonFile } from '../app-links';

export const dynamic = 'force-dynamic';

export function GET() {
  return jsonFile(appleAppSiteAssociation());
}
