// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Metro: depo kökündeki `shared/` klasörü (web ile ortak tipler, şemalar, etiketler) mobil pakete dahil edilir.
 * shared/ içindeki dosyaların bağımlılıkları (zod, luxon) daima mobil/node_modules'tan çözülür — EAS derlemesinde
 * kökte node_modules bulunmaz.
 */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = new Proxy({}, { get: (_, name) => path.join(projectRoot, 'node_modules', String(name)) });

module.exports = config;
