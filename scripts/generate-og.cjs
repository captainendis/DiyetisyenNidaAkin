/**
 * Sosyal paylaşım görseli (og-image.jpg, 1200×630) ve apple-touch-icon.png (180×180) üretir.
 * Gerçek mekân fotoğrafını ve marka tipografisini kullanır. Kullanım: node scripts/generate-og.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const f = (p) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'node_modules', p)).toString('base64');
const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'public/images/mekan-cephe-1000.webp')).toString('base64');
const logo = fs.readFileSync(path.join(root, 'public/logo.svg'), 'utf8');
const fonts = `
@font-face{font-family:C;src:url(${f('@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-ext-wght-normal.woff2')});font-weight:300 700;unicode-range:U+0100-02AF}
@font-face{font-family:C;src:url(${f('@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2')});font-weight:300 700}
@font-face{font-family:M;src:url(${f('@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2')});font-weight:200 800;unicode-range:U+0100-02AF}
@font-face{font-family:M;src:url(${f('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')});font-weight:200 800}`;

const og = `<html><head><style>${fonts}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:#211710;color:#F4EBDD;font-family:M;position:relative;overflow:hidden}
.ph{position:absolute;right:0;top:0;width:560px;height:630px;background:url(${img}) center 30%/cover}
.ph:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#211710 0%,rgba(33,23,16,.25) 40%,rgba(33,23,16,0) 70%),linear-gradient(0deg,rgba(33,23,16,.6),transparent 40%)}
.c{position:absolute;left:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:640px}
.logo{width:64px;height:64px;margin-bottom:46px}
.e{font-size:15px;letter-spacing:.24em;text-transform:uppercase;color:rgba(244,235,221,.75);display:flex;align-items:center;gap:18px}
.e:after{content:'';width:56px;height:1px;background:rgba(244,235,221,.4)}
h1{font-family:C;font-weight:500;font-size:118px;line-height:.92;margin-top:26px;color:#FAF6EF}
h1 span{display:block;color:#DDAFA0}
p{margin-top:30px;font-size:22px;line-height:1.5;color:rgba(244,235,221,.8);max-width:470px}
</style></head><body><div class="ph"></div><div class="c"><div class="logo">${logo}</div><div class="e">Sağlıklı yaşam, doğru beslenme ile başlar</div><h1>Nida Akın<span>Diyetisyen</span></h1><p>Yasaklarla değil, dengeyle. Kişiye özel beslenme danışmanlığı.</p></div></body></html>`;

const icon = `<html><body style="margin:0;width:180px;height:180px;background:#211710;display:flex;align-items:center;justify-content:center">
<div style="width:118px;height:118px">${logo.replace('stroke-width="1.6"', 'stroke-width="2.2"')}</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(og, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(root, 'public/og-image.jpg'), type: 'jpeg', quality: 86 });
  await p.setViewportSize({ width: 180, height: 180 });
  await p.setContent(icon);
  await p.screenshot({ path: path.join(root, 'public/apple-touch-icon.png') });
  await p.setViewportSize({ width: 512, height: 512 });
  await p.setContent(icon.replace(/180px/g, '512px').replace(/118px/g, '330px'));
  await p.screenshot({ path: path.join(root, 'public/icon-512.png') });
  await b.close();
  console.log('✓ og-image.jpg, apple-touch-icon.png, icon-512.png');
})();
