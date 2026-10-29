# Devlog

> Status: **Proposed** · Last updated: 2026-10-29 · Code: `apps/web` · Design: [hobai App Design canvas](https://claude.ai/artifact/7CrGGxQmeSht3KyDnahRUr), boards **Devlog** and **Devlog: post** (Signed out row) · Related: [ui.md](./ui.md), [web.md](./web.md), [development-plan.md](./development-plan.md)

A public build-in-public log at `hobai.app/devlog`: what shipped, what broke, and why hobai is built the way it is. Posts can hold interactive Claude artifacts, diagrams, tables and code alongside the writing. This file covers what it is, how a post is written, how it's built, and the order we build it in.

## 1. What it is

- **Public and signed-out first.** It lives with the landing and pricing pages, not inside the app. Anyone can read it; signed-in visitors see **Open hobai** in the header, as on the other public pages.
- **Posts live in the repository.** One MDX file per post, published by merging a PR. No database, no admin screen, no API involvement.
- **Static.** Every page is built ahead of time: fast, readable by search engines, nothing to break at request time.
- **Rich posts.** Markdown for the writing, plus a few components of our own for interactive artifacts and figures. Tables and code use plain Markdown.
- **Followable.** An RSS feed at `/devlog/rss.xml`, and link previews on LinkedIn and X.

Not in scope now: tags, search, comments, a newsletter, an in-app "what's new" panel, Mermaid diagrams (§10).

## 2. Design

Drawn on the canvas, Signed out row. The canvas is the visual source of truth; this section is the written one.

### 2.1 Devlog (`/devlog`)

- The shared site header with a new **Devlog** menu item (current page marked), the grid backdrop and glow, as on Pricing.
- Hero: a **Devlog** badge, the heading "Building hobai", one line ("What shipped, what broke, and why it's built the way it is."), and a **Follow with RSS** link.
- **Latest:** the newest post as a large card with the beam border: Latest badge, date, title, summary, "Read post →". The whole card is the link.
- **Earlier:** every other post, newest first, as rows: the date (mono, a fixed left column) and the title and summary on the right. At phone width the date sits above the title.
- **Empty state:** "No posts yet" in a card, with the RSS hint. Shown only if every post is a draft.
- Footer: the existing footer plus **Devlog** and **RSS** links.

### 2.2 Devlog post (`/devlog/[slug]`)

- A **← Devlog** link, then the date and author, the title, and the summary as the lead paragraph.
- A 720 px reading column. Prose styles for headings, paragraphs, lists, bold, links, inline code, code blocks and quotes.
- **Figure:** an image or diagram with a caption under it.
- **Artifact:** a framed box with a top bar showing the title, an **Interactive** badge and **Open full screen ↗**. The artifact runs inside; a caption sits under the box.
- **Table:** a header row on the muted surface, rows split by borders, first column muted. The table scrolls sideways inside its box on narrow screens.
- Signed out: a **Try it on one of your repos** card with **Start free**. Signed in: no card.
- **More posts:** links to the previous post and back to the list.

### 2.3 Elsewhere

- **Devlog** joins the header menu on every public page (landing, pricing, devlog), after Pricing.
- The footer gets **Devlog** on every public page.

## 3. Writing a post

### 3.1 Files

```
apps/web/
  content/devlog/
    hobai-is-live.mdx              one file per post; the filename is the slug
    plans-and-usage-limits.mdx
  public/devlog-assets/
    hobai-is-live/                 one folder per post, named by its slug
      run-lifecycle.html           a Claude artifact, as downloaded
      sandbox-flow.svg             a diagram
      sandbox-flow-dark.svg        its dark-mode version (optional)
      run-view.png                 a screenshot
```

The slug is lowercase words joined by `-` (`[a-z0-9-]+`). It becomes the URL, so it doesn't change after publishing.

### 3.2 The header (frontmatter)

```mdx
---
title: hobai is live
date: 2026-11-02
summary: Describe a clear coding task, and hobai opens the pull request. Here's how it works end to end.
author: Shilendra Singh
draft: false
---
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Plain text, used as the page title and in the feed |
| `date` | yes | `YYYY-MM-DD`. Posts sort by it, newest first; same-day posts by title |
| `summary` | yes | One or two sentences. Shown in the list, as the lead, in the feed and in link previews. At most 200 characters |
| `author` | no | Defaults to `Shilendra Singh` |
| `draft` | no | `true` hides the post from the list, the feed and the build in production; it still shows in `pnpm dev` |
| `image` | no | A `.png` or `.jpg` in the post's assets folder (`card.png`), 1200×630, used for link previews instead of the generated one (§4.8) |

A header that's missing a field or has a wrong value fails the build with the file name and the field, so a broken post can't ship.

### 3.3 What a post can contain

Plain Markdown (GitHub style):

- Headings from `##` down (the title is the page's only `#`), paragraphs, **bold**, *italic*, links, lists, quotes.
- Tables, written as Markdown tables.
- Code blocks with a language (` ```ts `) get syntax highlighting, in light and dark.

Our components:

```mdx
<Artifact
  src="run-lifecycle.html"
  title="Run lifecycle"
  height={520}
  caption="Click a stage to see what happens there."
/>

<Figure
  src="sandbox-flow.svg"
  darkSrc="sandbox-flow-dark.svg"
  alt="Your repository goes into a sandbox, through checks, and out as a pull request."
  caption="Where your code goes during a run."
  width={1200}
  height={480}
/>
```

`src` is relative to the post's folder in `public/devlog-assets/`. A component pointing at a file that doesn't exist fails the build.

### 3.4 Adding a Claude artifact

1. Make the artifact in Claude. Ask for it to **read `?theme=light|dark` from its address and use that over the system setting**, so it matches the site (§4.6).
2. Download its HTML and save it as `public/devlog-assets/<slug>/<name>.html`.
3. Open it in the browser on its own once (`pnpm dev`, then `/devlog-assets/<slug>/<name>.html`) to check it works without claude.ai.
4. Add `<Artifact src="<name>.html" title="…" height={…} />` where it belongs. Pick a height that shows it without an inner scrollbar at desktop width.

The artifact's scripts may load from public CDNs (cdnjs, jsdelivr, unpkg); those keep working. It must not need anything from claude.ai: no sign-in, no `window.claude` calls, no shared storage.

### 3.5 Adding a diagram or screenshot

- **Diagrams:** ask Claude for an SVG, or export one. Give a dark version as `darkSrc` when the colours don't work on both backgrounds. A diagram that should be interactive is an artifact instead.
- **Screenshots:** PNG or WebP, at least 1440 px wide. Take light-mode and dark-mode shots and pass both when the site's theme matters.
- Always write `alt` text that says what the picture shows.

### 3.6 Publishing

Write the post on a branch, check it with `pnpm dev` (light, dark, phone width), open a PR, merge. The web app's deploy builds it. To prepare a post early, merge it with `draft: true` and flip it later.

## 4. How it's built

### 4.1 Libraries

| | |
|---|---|
| `next-mdx-remote-client` | Compiles a post's MDX in a server component at build time. Takes the file's text, so the header can be read separately, and needs no Next or Turbopack plugin. The version is checked when it's installed |
| `yaml` | Reads the header with the YAML core schema, so dates stay as written: YAML 1.1 parsers (gray-matter's included) quietly turn `2026-02-30` into March 2 |
| `remark-gfm` | Tables, strikethrough, autolinks |
| `rehype-pretty-code` + `shiki` | Syntax highlighting at build time, with light and dark themes in one output |
| `rehype-slug` | Ids on headings, so sections can be linked |
| `zod` | Checks each post's header (already used in `@hobai/shared`) |

No client-side Markdown or highlighting: the reader downloads finished HTML.

### 4.2 Routes

| Route | File | Rendering |
|---|---|---|
| `/devlog` | `app/(marketing)/devlog/page.tsx` | Static |
| `/devlog/[slug]` | `app/(marketing)/devlog/[slug]/page.tsx` | Static, one page per published post (`generateStaticParams`, `dynamicParams = false`, so an unknown slug is a 404) |
| `/devlog/rss.xml` | `app/(marketing)/devlog/rss.xml/route.ts` | Static (`dynamic = "force-static"`) |
| `/devlog/[slug]/opengraph-image` | `app/(marketing)/devlog/[slug]/opengraph-image.tsx` | Static, generated per post |
| `/devlog-assets/…` | `public/devlog-assets/` | Static files |

`lib/routes.ts` gains `DEVLOG = "/devlog"`, `devlogPostPath(slug)` and `DEVLOG_RSS`.

### 4.3 Server pages and the signed-in header

Unlike Pricing (a client component, because it reads the session), devlog pages are **server components**: the MDX compiles at build time and only finished HTML reaches the browser. The one signed-in difference, the header button and the Start free card, comes from small client components:

- `DevlogHeader`: reads `useSession()` and renders the existing `SiteHeader` with Devlog marked. Signed out is rendered first, so the static HTML matches what most readers see.
- `SignedOutOnly`: renders its children only without a session. It wraps the post's Start free card.

Both live in `app/(marketing)/devlog/session.tsx`: components can't read the session (ESLint keeps data out of `components/`), pages can.

`SiteHeader` gets `"devlog"` as a `current` value and a **Devlog** link, on every public page. At phone width it hides How it works and Security, so the menu fits on one line. `SiteFooter` gets the Devlog and RSS links.

### 4.4 Code structure

Following [web.md](./web.md) §6:

```
apps/web/
  content/devlog/*.mdx                    the posts
  public/devlog-assets/<slug>/…           artifacts, diagrams, screenshots
  features/devlog/
    post-schema.ts                        zod schema for the header
    posts.ts                              getPosts(), getPost(slug): read, check, sort, hide drafts in production
    posts.test.ts
    assets.ts                             devlogAssetUrl(slug, file): a post's asset address; fails the build if the file is missing
    devlog.ts                             the devlog's title and description
    rss.ts                                buildRss(posts, siteUrl): the feed's XML
    rss.test.ts
  components/
    molecules/devlog-date.tsx             a date in the house format ("Oct 26, 2026", UTC so it never shifts a day; `formatPostDate` in lib/format.ts)
    molecules/artifact-embed.tsx          the framed, sandboxed artifact (client: reads the theme)
    molecules/figure.tsx                  image or diagram with caption and dark variant
    organisms/devlog-latest-card.tsx
    organisms/devlog-post-list.tsx
    organisms/devlog-post-pager.tsx
    organisms/devlog-prose.tsx            compiles a post's MDX (imports and exports stripped) into the prose wrapper
    organisms/devlog-cta.tsx              "Try it on one of your repos"
  app/(marketing)/devlog/
    page.tsx · devlog.tsx                 list: the page loads posts, the view renders them
    session.tsx                           DevlogHeader and SignedOutOnly (client)
    [slug]/page.tsx · [slug]/post.tsx     post
    [slug]/post-components.tsx            the components posts can use (Figure, Artifact): checks their props and resolves asset files
    [slug]/themed-artifact.tsx            ArtifactEmbed with the site's current theme (client)
    [slug]/opengraph-image.tsx
    rss.xml/route.ts
```

`features/devlog` reads files rather than calling the API, but it's still the data layer: pages call it, and components never do.

### 4.5 The post loader

`getPosts()`:

1. Reads every `*.mdx` in `content/devlog/`.
2. Splits off the `---` header, reads it with `yaml`, and checks it with the zod schema (unknown fields are errors, so a typo like `summray` doesn't pass). An error names the file and the field.
3. Checks the slug format, and that `date` is a real calendar date.
4. Drops drafts when `NODE_ENV === "production"`.
5. Sorts by date (newest first), then title.

It returns `{ slug, title, date, summary, author, image?, body }[]`. `getPost(slug)` returns one, or null. Both are cached for the build (React `cache`), so the list, the posts, the feed and the preview images read the files once.

### 4.6 The Artifact embed

```tsx
<iframe
  src={`/devlog-assets/${slug}/${src}?theme=${resolvedTheme}`}
  title={title}
  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
  referrerPolicy="no-referrer"
  loading="lazy"
  style={{ height }}
/>
```

- **Isolated from hobai.** Without `allow-same-origin`, the artifact runs in an opaque origin of its own. hobai.app serves the app and proxies `/api` with the session cookie on the same origin, so the artifact can't call the API as the reader, see their session, or read the page around it.
- **Isolated opened on its own, too.** **Open full screen** opens the HTML file in a new tab, where an iframe attribute doesn't apply. So `next.config.ts` sends `Content-Security-Policy: sandbox allow-scripts allow-popups` on every `/devlog-assets/:path*` response. The browser then sandboxes the file the same way however it's opened.
- **Theme.** `ThemedArtifact` (a client component in the route folder, since components don't read app state) reads next-themes' resolved theme and adds `?theme=light|dark` to the address, which the artifact reads (§3.4). Until the theme is known, after the first render, the frame shows the muted surface instead of loading twice.
- **Size.** `height` is required, in px, between 120 and 2000. At phone width the frame is full width, at the same height. Artifacts don't report their own size: that needs a script in every artifact and a message channel, and fixed heights are enough for now.
- **Loading.** `loading="lazy"`, so artifacts further down a post load only when you reach them.
- The top bar's title is `title`; **Open full screen** links to the file with `target="_blank" rel="noopener"`.

### 4.7 Figures, tables and code

- **Figure:** `next/image` with the given `width` and `height` (so the page doesn't jump while it loads). With `darkSrc`, both images render and CSS shows one (`dark:hidden` / `hidden dark:block`, next-themes' class strategy). SVGs skip image optimization (`unoptimized`).
- **Tables:** the MDX component map wraps every `table` in a box that scrolls sideways (`overflow-x-auto`), with the canvas styles: a header row on `bg-muted`, 1 px row borders, a muted first column.
- **Code:** rehype-pretty-code with `github-light` and `github-dark`, both written into the HTML as CSS variables. The stylesheet picks the right one under `.dark`. Blocks scroll sideways; there's no line wrapping, so code stays readable.
- **Prose:** `devlog-prose.tsx` styles everything inside a post with the design tokens (no `@tailwindcss/typography`, so the look matches the canvas exactly): 16.5 px text at 1.75 line height, `text-muted-foreground` body, `text-foreground` headings and bold, underlined links, and inline code on `bg-muted`.

### 4.8 Metadata, link previews and the feed

- **Each page:** `generateMetadata` sets the title (`<title> · hobai devlog`), the description (the summary), canonical URL, and Open Graph and Twitter card fields (`article`, published time, author).
- **Preview image:** `opengraph-image.tsx` draws a 1200×630 card with `next/og`: the dark surface, the hobai logo, the post title in Geist, the date and `hobai.app/devlog`. The fonts come from the `geist` package's TTF files (the preview renderer can't read woff2). A post's `image` field replaces it.
- **Absolute URLs** come from `SITE_URL` in `lib/routes.ts`, built from `DOMAIN` in `@hobai/shared/brand` (`https://hobai.app`). It's also the root layout's `metadataBase`.
- **RSS 2.0:** the channel (title "hobai devlog", link, description, language) and one item per published post, newest first: title, link, `guid` (the post URL), `pubDate` (RFC 822, midnight UTC) and the summary as `description`. Summaries only: artifacts and figures don't survive in feed readers, so the feed links to the real post. Text is XML-escaped.
- The devlog pages advertise the feed with `<link rel="alternate" type="application/rss+xml">`, so feed readers find it from the page address.

### 4.9 Deploy

Nothing new to set up. The web app's build (Vercel) builds every post, and the assets ship from `public/`. A post goes live when its PR merges.

## 5. Accessibility

- Every page has one `h1`, and headings don't skip levels.
- The Latest card and list rows are real links. The list is a list of `article`s.
- Artifact frames have a `title`; figures have `alt` text (required by the component's types).
- Text meets 4.5:1 in both themes (the canvas tokens already do).
- The beam and glow stop under `prefers-reduced-motion`, like the rest of the site.

## 6. Testing

Following [web.md](./web.md) §9, with fixtures under `features/devlog/__fixtures__/`, not the real posts:

- **Loader (`posts.test.ts`):** reads and sorts, same-date order, drafts hidden in production and shown in development, a missing or wrong header field throws with file and field, a bad slug throws, `getPost` on an unknown slug is null.
- **Feed (`rss.test.ts`):** valid XML, items in order, absolute links, RFC 822 dates, special characters in a title escaped.
- **Components:** the post list (latest card separate from Earlier, empty state), `DevlogDate` (no day shift across time zones), `ArtifactEmbed` (always has `sandbox` with `allow-scripts` and never `allow-same-origin`, adds the theme to the address, uses the given height), `Figure` (dark variant), `SignedOutOnly`.
- **Config:** a test that `next.config.ts`'s headers put the sandbox CSP on `/devlog-assets/:path*`.
- **By hand, per batch:** `pnpm dev` against the canvas, light and dark, at phone width; a link preview checked with a card validator once deployed.

No end-to-end test: these pages have no flow, and the unit tests cover the rules.

## 7. Build plan

One branch, `feat/devlog`, in small batches. Each batch is built, explained and reviewed, then committed, before the next starts ([development-plan.md](./development-plan.md) §3).

| # | Batch | Done when |
|---|---|---|
| 1 | **Post loader.** `post-schema.ts`, `posts.ts`, fixtures and tests; `yaml` and zod. | `getPosts` and `getPost` pass their tests |
| 2 | **Pages with plain Markdown.** `/devlog` and `/devlog/[slug]` as server pages; `next-mdx-remote-client` with `remark-gfm` and `rehype-slug`; `DevlogDate`, the list, latest card, pager and prose styles (in `globals.css`); `DevlogHeader`, `SignedOutOnly`, the CTA; routes; Devlog in the header menu. One placeholder post (a draft) in `content/devlog/` to see it render | Both pages match the canvas in light and dark at desktop and phone width, with headings, lists, quotes and inline code |
| 3 | **Tables, code and figures.** The table wrapper, rehype-pretty-code + shiki, `Figure` with dark variants | A test post's table, code block and figure match the canvas |
| 4 | **Artifact embed.** `ArtifactEmbed` with its sandbox, theme and lazy loading; the CSP header on `/devlog-assets`; tests | An artifact downloaded from Claude works in the post and full screen; from inside it, `fetch("/api/me")` and `document.cookie` don't reach hobai |
| 5 | **Navigation, metadata and feed.** Devlog and RSS in the footer; `generateMetadata`; the preview image; `rss.xml` with its tests and the `alternate` link | The feed validates (W3C Feed Validator) and loads in a feed reader; a post link shows its card in a preview validator |
| 6 | **Docs.** ui.md (the two screens), web.md (routes, structure), this file's status to Accepted, the development plan ticked | Docs match what's built |

The placeholder post is removed in batch 6. **The first real post** ("hobai is live", from `launch-posts.md`, with the run lifecycle artifact and a run screenshot) is its own PR after the branch merges, so writing it doesn't hold up the code. It goes up with the launch.

## 8. Decisions

| Decision | Why |
|---|---|
| MDX files in the repo, not a database or CMS | One author, posts reviewed like code, no admin screen to build or secure |
| Artifacts hosted on hobai, not linked from claude.ai | claude.ai artifacts are private by default and can change or disappear; a hosted copy stays exactly as published |
| Sandbox without same-origin, plus a CSP sandbox header | The devlog shares an origin with the signed-in app and the `/api` proxy; the header covers files opened outside the frame |
| Fixed artifact heights | Auto-height needs a script in every artifact and a message channel; not worth it yet |
| Summaries in the feed, not full posts | Artifacts and figures don't work in feed readers |
| Our own prose styles, not `@tailwindcss/typography` | Match the canvas exactly with the existing tokens |
| `next-mdx-remote-client` over `@next/mdx` | The header is read separately, and it needs no bundler plugin under Turbopack |

## 9. Risks

- **An artifact changes behaviour outside claude.ai.** Some depend on claude.ai's runtime (storage, `window.claude`). The check in §3.4 step 3 catches it before publishing.
- **A CDN script an artifact loads changes or goes away.** The sandbox limits what a changed script can do; a broken artifact shows an empty frame. Ask Claude for pinned versions (it already uses exact versions).
- **Build time grows with posts.** Shiki and the preview images run per post at build time. That's fine for tens of posts; revisit past ~100.

## 10. Later

Tags and a filter on the list · reading time · Mermaid diagrams compiled at build time · artifacts that size themselves · an email signup · a "what's new" dot in the app pointing to the latest post · a sitemap covering every public page.
