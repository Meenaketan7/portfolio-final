# SEO in the SvelteKit starter

This starter has the code needed to render public pages and their search metadata on the server. It has no real domain or published content. The home, About, and Contact placeholders are marked `noindex`. Blog, project, and content pages need the Phoenix API described below before they can serve real pages.

Search engines still decide what to crawl and index. Good metadata and a sitemap do not promise a ranking.

## Add a public page

The `(public)` layout reads the page's `seo` data and writes its title, description, canonical URL, social tags, language links, and optional structured data into the HTML response. Set the title and description in the page load function. Write the visible page content in the Svelte component.

```ts
import type { PageLoad } from './$types';
import { extractLocaleFromUrl } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';

export const load: PageLoad = ({ url }) => {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	return {
		seo: {
			title: m.your_page_title({}, { locale }),
			description: m.your_page_description({}, { locale })
		}
	};
};
```

Add the message keys and visible copy for every language you publish. The title and description should describe that page, not just the site. If either is missing, or if `noindex: true` is set, the layout emits `noindex`. It also does this when `ORIGIN` is missing. Such pages receive no canonical URL or structured data.

When a static route has real content and is ready for search, add its path and published locales to [`src/config/seo/static-pages.ts`](src/config/seo/static-pages.ts). That registry starts empty so the sitemap does not advertise placeholder pages. Use the `alternates` field only for live translations of the same page. The language switcher also uses this map when translated slugs differ.

## Publish content from Phoenix

The starter includes server routes for `/blog`, `/blog/[slug]`, `/projects`, `/projects/[slug]`, and `/pages/[slug]`. They fetch their main content in `+page.server.ts`, so a crawler receives the article, title, and metadata in the initial HTML. TanStack Query can update a page after load, but should not be the only source of its main content.

Phoenix still needs these public reads:

| Path                                                                               | Response                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/v1/content/posts/{slug}` and the equivalent `pages` and `projects` paths | One published record in the requested language.              |
| `GET /api/v1/content/posts?limit=20&cursor=...` and the equivalent `projects` path | Published summaries and a `nextCursor`.                      |
| `GET /api/v1/content/discovery?limit=200&cursor=...`                               | Published, indexable URLs in every language for the sitemap. |

The frontend sends the page language in `Accept-Language`. Phoenix should select that translation, return `Content-Language`, and use `Vary: Accept-Language` on cacheable language dependent responses. The public record must contain a stable ID, locale, slug, title, summary, dates, safe text blocks, effective SEO fields, and the published translation slugs. The frontend checks these fields before rendering. It escapes article text; raw HTML from the API is not rendered. The planned Phoenix model and publishing work are in [BACKEND_PLAN.md](../BACKEND_PLAN.md).

Return 404 for missing or unpublished content, and 410 for retired content. If a slug has changed, return the current record and let SvelteKit redirect to its new URL. An API outage stays a server error instead of becoming an empty page. Empty lists and cursor pages are `noindex`. The first page of a nonempty list can be indexed.

## Languages and URLs

English uses `/` and `/blog/post`. The other language paths start with `/es`, `/pt-br`, `/de`, `/fr`, or `/ja`. Old `/en` page URLs redirect to the English path. Each published translation has its own canonical URL. Its language links use `pt-BR` for Portuguese and point only to other published translations. English is the `x-default` target when it exists.

The API path never gets a language prefix. For example, a request for `/ja/blog/post` calls `/api/v1/content/posts/post` with `Accept-Language: ja`. Paraglide and the SvelteKit reroute hook leave `/api/*` alone. The API client in [`src/config/api/request.ts`](src/config/api/request.ts) accepts an explicit `locale` option for language dependent reads; ordinary requests and sitemap discovery omit it.

## Sitemap, robots, and page data

`/sitemap.xml` combines the static registry with Phoenix's discovery feed. It includes each published canonical URL, its update date, and the same published language links as the page. It also includes nonempty blog and project list roots. If discovery fails, the endpoint returns 503 so it does not publish a partial sitemap. The endpoint currently has a limit of 50,000 URLs and 50 MB. Split it into several sitemaps if the project grows beyond that. `/robots.txt` points to the sitemap when `ORIGIN` is set.

Published articles can include `BlogPosting` JSON-LD. Projects use `CreativeWork`; other content pages use `WebPage`. The fields must match the visible page. Supply a real public image and alt text if a page needs a large social preview. Add business, person, or organization data only when the project has the real facts for it.

## Before launch

1. Set `ORIGIN` to the real public HTTPS origin at runtime, such as `https://example.com`. Do not include a path. The Node adapter also uses this value for request checks. The built server does not read `.env` files by itself.
2. Set private `PHOENIX_API_ORIGIN` if the site uses content pages. Keep Phoenix and SQLite private, and expose SvelteKit and its `/api` proxy through one HTTPS host. Run the frontend with `bun run build` and `node build`.
3. Replace the placeholder pages, favicon, and sample metadata. Check that each intended language has real content. Set image dimensions or reserve image space, and optimize the image files.
4. Run `bun run format:check`, `bun run lint`, `bun run check`, `bun run test`, and `bun run build`. On the deployed domain, inspect the response HTML for a representative page in every language. Check the status, title, canonical URL, language links, structured data, `robots.txt`, and `sitemap.xml`.
5. Verify the domain in Google Search Console and Bing Webmaster Tools, submit the sitemap, and watch indexing and Core Web Vitals. Measure real pages before tuning them. AI search has no separate Google markup requirement. Useful content, clear answers, relevant links, and accurate authorship help people find and trust the site. Local business markup and paid search are project decisions, not starter defaults.

The frontend type check, lint, format check, tests, and Node build pass locally. Phoenix content endpoints, real content, a domain, deployment, and live search checks are still needed before calling a site ready for public search.

References: [SvelteKit SEO](https://svelte.dev/docs/kit/seo), [Node adapter](https://svelte.dev/docs/kit/adapter-node), [Google language versions](https://developers.google.com/search/docs/specialty/international/localized-versions), [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features).
