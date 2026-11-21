// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { appleAppSiteAssociation, assetLinks, jsonFile, normalizeFingerprint } from '../src/app/.well-known/app-links';

const FP = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89';

describe('apple-app-site-association', () => {
  it('APPLE_TEAM_ID yoksa ya da hatalıysa 404', async () => {
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: 'kısa' })).toBeNull();
    expect(jsonFile(appleAppSiteAssociation({})).status).toBe(404);
  });

  it('yalnızca e-postadaki bağlantı yollarını uygulamaya yönlendirir', async () => {
    const aasa = appleAppSiteAssociation({ APPLE_TEAM_ID: 'abcde12345' })!;
    const d = aasa.applinks.details[0]!;
    expect(d.appIDs).toEqual(['ABCDE12345.com.nidaakin.app']);
    expect(d.components.map((c) => c['/'])).toEqual(['/hesabim/etkinlestir*', '/hesabim/sifre-sifirla*', '/panel/sifre-sifirla*']);
    expect(d.paths).toEqual(['/hesabim/etkinlestir*', '/hesabim/sifre-sifirla*', '/panel/sifre-sifirla*']);
    const res = jsonFile(aasa);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual(aasa);
  });
});

describe('assetlinks.json', () => {
  it('parmak izi yoksa ya da geçersizse 404', () => {
    expect(assetLinks({})).toBeNull();
    expect(assetLinks({ ANDROID_CERT_SHA256: 'xyz, 12:34' })).toBeNull();
  });

  it('virgülle ayrılmış parmak izlerini normalize eder', () => {
    const plain = FP.replace(/:/g, '').toLowerCase();
    expect(normalizeFingerprint(plain)).toBe(FP);
    const links = assetLinks({ ANDROID_CERT_SHA256: ` ${FP} , ${plain}, ${FP.replace('AB', '00')} ` })!;
    expect(links[0]!.target.package_name).toBe('com.nidaakin.app');
    expect(links[0]!.target.sha256_cert_fingerprints).toEqual([FP, FP.replace('AB', '00')]);
    expect(links[0]!.relation).toEqual(['delegate_permission/common.handle_all_urls']);
  });
});
