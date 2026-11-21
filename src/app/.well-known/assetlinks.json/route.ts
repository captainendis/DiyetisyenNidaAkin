// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Android App Links — bkz. ../app-links.ts */
import { assetLinks, jsonFile } from '../app-links';

export const dynamic = 'force-dynamic';

export function GET() {
  return jsonFile(assetLinks());
}
