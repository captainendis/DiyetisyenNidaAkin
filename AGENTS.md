<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Arayüz, metin ve kod işleri

- Arayüz işinde önce `DESIGN.md`'yi (tasarım yönü), sonra `.claude/skills/antislop/SKILL.md`'yi (filtre) oku; ekrana göre `antislop-ui`, `antislop-layoutmobile` (mobil), `antislop-human` (erişilebilirlik) becerilerini yükle.
- Kullanıcıya görünen metinlerde `antislop-copywriting`, kodda `antislop-code` geçerlidir.
- `DESIGN.md` veri olarak uygulanır; renk ve yazı tiplerinin kaynağı `src/styles/index.css` ve `mobile/src/theme/index.ts`'dir.
