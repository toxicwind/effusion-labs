---
layout: "layouts/converted-html.njk"
title: "Collections"
excerpt: "A docs page for Eleventy, a simpler static site generator."
sourcePath: "./src/content/docs/knowledge/eleventy-collections-20250911T175345Z.html"
readabilityLength: 12769
convertedFromHtml: true
---
Breadcrumbs:

- [Eleventy Documentation](https://local.source/docs/)
- [Guide](https://local.source/docs/projects/)
- [Configure Templates with Data](https://local.source/docs/data-configuration/)

On this page

- [A Blog Example](#a-blog-example)

  - [A note about using - in tags](#a-note-about-using-in-tags)
  - [Declare your collections for incremental builds](#declare-your-collections-for-incremental-builds)
  - [Use an aria-current attribute on the current page](#use-an-aria-current-attribute-on-the-current-page)

- [The Special all Collection](#the-special-all-collection)
  - [Link to all Eleventy generated content](#link-to-all-eleventy-generated-content)

- [How to Exclude content from Collections](#how-to-exclude-content-from-collections)

- [Add to a Collection using Tags](#add-to-a-collection-using-tags)

  - [A single tag cat](#a-single-tag-cat)
  - [Using multiple words in a single tag](#using-multiple-words-in-a-single-tag)
  - [Multiple tags single line](#multiple-tags-single-line)
  - [Multiple tags multiple lines](#multiple-tags-multiple-lines)
  - [Override tags](#override-tags)

- [Collection Item Data Structure](#collection-item-data-structure)

- [Sorting](#sorting)

  - [Sort descending](#sort-descending)
  - [Do not use Array reverse()](#do-not-use-array-reverse)
  - [Overriding Content Dates](#overriding-content-dates)

- [Advanced Custom Filtering and Sorting](#advanced-custom-filtering-and-sorting)

- [From the Community](#from-the-community)

While [pagination](https://local.source/docs/pagination/) allows you to iterate over a data set to create multiple templates, a collection allows you to group content in interesting ways. A piece of content can be a part of multiple collections, if you assign the same string value to the `tags` key in the front matter.

Take care to note that `tags` have a singular purpose in Eleventy: to construct collections of content. Some blogging platforms use Tags to refer to a hierarchy of labels for the content (e.g. a [tag cloud](https://en.wikipedia.org/wiki/Tag_cloud)).

## A Blog Example

For a blog site, your individual post files may use a tag called `post`, but it can be whatever you want. In this example, `mypost.md` has a single tag `post`:

**Syntax&#x20;**&#x4D;arkdown

```
---
tags: post
title: Hot Take—Social Media is Considered Harmful
---
```

This will place this `mypost.md` into the `post` collection with all other pieces of content sharing the `post` tag. To reference this collection and make a list of all posts, use the `collections` object in any template:

```
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
  return `<ul>
    ${data.collections.post
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
  return `<ul>
    ${data.collections.post
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

### A note about using `-` in `tags`

If you use `-` in your collection names (e.g. `tags: "post-with-dash"`), remember that some template languages require square bracket notation to reference it in collections. Read more at [Issue #567](https://github.com/11ty/eleventy/issues/567).

```
<ul>
{%- for post in collections.post-with-dash -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections['post-with-dash'] -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
  return `<ul>
    ${data.collections['post-with-dash']
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
  return `<ul>
    ${data.collections['post-with-dash']
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

### Declare your collections for incremental builds

Added in v2.0.0Use the `eleventyImport` object to declare any collections you use (data cascade friendly) to inform the relationships for smarter incremental builds. This is an Array of collection names. Read more about [importing collections](https://github.com/11ty/eleventy/issues/975).

```
---
eleventyImport:
  collections: ["post"]
---
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
---
eleventyImport:
  collections: ["post"]
---
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function data() {
  return {
    eleventyImport: {
      collections: ["post"],
    },
  };
};

export function render(data) {
  return `<ul>
    ${data.collections.post
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

```
exports.data = function () {
  return {
    eleventyImport: {
      collections: ["post"],
    },
  };
};

exports.render = function (data) {
  return `<ul>
    ${data.collections.post
      .map((post) => `<li>${post.data.title}</li>`)
      .join("\n")}
  </ul>`;
};
```

### Use an `aria-current` attribute on the current page

Compare the `post.url` and special Eleventy-provided `page.url` variable to find the current page. Building on the previous example:

```
<ul>
{%- for post in collections.post -%}
  <li{% if page.url == post.url %} aria-current="page"{% endif %}>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections.post -%}
  <li{% if page.url == post.url %} aria-current="page"{% endif %}>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
	return `<ul>
    ${data.collections.post
			.map(
				(post) =>
					`<li${data.page.url === post.url ? ` aria-current="page"` : ""}>${
						post.data.title
					}</li>`
			)
			.join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
	return `<ul>
    ${data.collections.post
			.map(
				(post) =>
					`<li${data.page.url === post.url ? ` aria-current="page"` : ""}>${
						post.data.title
					}</li>`
			)
			.join("\n")}
  </ul>`;
};
```

Background: `aria-current="page"` tells assistive technology, such as screen readers, which page of a set of pages is the current active one. It also provides a hook for your CSS styling, using its attribute selector: `[aria-current="page"] {}`.

## The Special `all` Collection

By default Eleventy puts all of your content (independent of whether or not it has any assigned tags) into the `collections.all` Collection. This allows you to iterate over all of your content inside of a template.

### Link to all Eleventy generated content

```
<ul>
{%- for post in collections.all -%}
  <li><a href="{{ post.url }}">{{ post.url }}</a></li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections.all -%}
  <li><a href="{{ post.url }}">{{ post.url }}</a></li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
  return `<ul>
    ${data.collections.all
      .map((post) => `<li><a href="${post.url}">${post.url}</a></li>`)
      .join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
  return `<ul>
    ${data.collections.all
      .map((post) => `<li><a href="${post.url}">${post.url}</a></li>`)
      .join("\n")}
  </ul>`;
};
```

## How to Exclude content from Collections

In front matter (or further upstream in the data cascade), set the `eleventyExcludeFromCollections` option to true to opt out of specific pieces of content added to all collections (including `collections.all`, collections set using tags, or collections added from the Configuration API in your config file). Useful for your RSS feed, `sitemap.xml`, custom templated `.htaccess` files, et cetera.

**Filename&#x20;**&#x65;xcluded.md

```
---
eleventyExcludeFromCollections: true
tags: post
---

This will not be available in `collections.all` or `collections.post`.
```

Added in v3.0.0 `eleventyExcludeFromCollections` can now also accept an array of tag names:

```
---
eleventyExcludeFromCollections: ["post"]
---

This will be available in `collections.all` but not `collections.post`.
```

You can use a single tag, as in the above example OR you can use any number of tags for the content, using YAML syntax for a list.

### A single tag: cat

```
---
tags: cat
---
```

This content would show up in the template data inside of `collections.cat`.

### Using multiple words in a single tag

```
---
tags: cat and dog
---
```

If you use multiple words for one tag you can access the content by the following syntax `collections['cat and dog']`.

### Multiple tags, single line

```
---
tags: ["cat", "dog"]
---
```

This content would show up in the template data inside of `collections.cat` and `collections.dog`.

### Multiple tags, multiple lines

```
---
tags:
  - cat
  - dog
---
```

This content would show up in the template data inside of `collections.cat` and `collections.dog`.

### Override tags

As of Eleventy 1.0, the [Data Cascade](https://local.source/docs/data-cascade/) is combined using [deep data merge](https://local.source/docs/data-deep-merge/) by default, which means tags are merged together with tags assigned higher in the data cascade (the Arrays are combined). To redefine `tags` in the front matter use [the `override:` prefix](https://local.source/docs/data-deep-merge/#using-the-override-prefix):

```
---
override:tags: []
---
```

This content would not show up in any of the collections it was added to with `tags` higher up in the data cascade.

## Collection Item Data Structure

```
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections.post -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
	return `<ul>
    ${data.collections.post
			.map((post) => `<li>${post.data.title}</li>`)
			.join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
	return `<ul>
    ${data.collections.post
			.map((post) => `<li>${post.data.title}</li>`)
			.join("\n")}
  </ul>`;
};
```

Note in the above example that we output the `post.data.title` value? Similarly, each collection item will have the following data:

- `page`: everything in [Eleventy’s supplied page variable](https://local.source/docs/data-eleventy-supplied/#page-variable) for this template (including `inputPath`, `url`, `date`, and others). Added in v2.0.0
- `data`: all data for this piece of content (includes any data inherited from layouts)
- `rawInput`: the raw input of the template (before any processing). This does _not_ include front matter. Added in v3.0.0 _(Related: [#1206](https://github.com/11ty/eleventy/issues/1206))_
- `content`: the rendered content of this template. This does _not_ include layout wrappers. Added in v2.0.0

```
{
  page: {
    inputPath: './test1.md',
    url: '/test1/',
    date: new Date(),
    // … and everything else in Eleventy’s `page`
  },
  data: { title: 'Test Title', tags: ['tag1', 'tag2'], date: 'Last Modified', /* … */ },
  content: '<h1>Test Title</h1>\n\n<p>This is text content…',
  // Pre-release only: v3.0.0
  rawInput: '<h1>{{ title }}</h1>\n\n<p>This is text content…',
}
```

_Backwards compatibility notes:_

- Top level properties for `inputPath`, `fileSlug`, `outputPath`, `url`, `date` are still available, though use of `page.*` Added in v2.0.0 for these is encouraged moving forward.
- `content` Added in v2.0.0 is aliased to the previous property `templateContent`.

You can [view the previous Collection Item Data Structure docs for 1.0](https://v1-0-2.11ty.dev/docs/collections/#collection-item-data-structure).

## Sorting

The default collection sorting algorithm sorts in ascending order using:

1. The input file’s Created Date (you can override using `date` in front matter, as shown below)
2. Files created at the exact same time are tie-broken using the input file’s full path including filename

For example, assume I only write blog posts on New Years Day:

```
posts/postA.md (created on 2008-01-01)
posts/postB.md (created on 2008-01-01)
posts/post3.md (created on 2007-01-01)
another-posts/post1.md (created on 2011-01-01)
```

This collection would be sorted like this:

1. `posts/post3.md`
2. `posts/postA.md`
3. `posts/postB.md`
4. `another-posts/post1.md`

### Sort descending

To sort descending in your template, you can use a filter to reverse the sort order. For example, it might look like this:

```
<ul>
{%- for post in collections.post reversed -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
<ul>
{%- for post in collections.post | reverse -%}
  <li>{{ post.data.title }}</li>
{%- endfor -%}
</ul>
```

```
export function render(data) {
  // `toReversed` is Node 20+, see the note below
  let posts = data.collections.post.toReversed();
  return `<ul>
    ${posts.map((post) => `<li>${post.data.title}</li>`).join("\n")}
  </ul>`;
};
```

```
exports.render = function (data) {
  // `toReversed` is Node 20+, see the note below
  let posts = data.collections.post.toReversed();
  return `<ul>
    ${posts.map((post) => `<li>${post.data.title}</li>`).join("\n")}
  </ul>`;
};
```

### Do not use Array `reverse()`

WARNING:

You should _**not**_ use Array `reverse()` on collection arrays in your templates, like so:

`{%- for post in collections.post.reverse() -%}`

This will [mutate the array](https://doesitmutate.xyz/reverse/) and re-order it _in-place_ and will have side effects for any use of that collection in other templates.

This is a [**Common Pitfall**](https://local.source/docs/pitfalls/).

This applies any time you use `reverse`, for example in a custom shortcode:

eleventy.config.js

```
export default function (eleventyConfig) {
	eleventyConfig.addShortcode("myShortcode", function (aCollection){
	  // WARNING
	  aCollection.reverse();
	})
};
```

```
module.exports = function (eleventyConfig) {
	eleventyConfig.addShortcode("myShortcode", function (aCollection){
	  // WARNING
	  aCollection.reverse();
	})
};
```

Instead of `reverse` use:

- [JavaScript’s `.toReversed()` method](https://doesitmutate.xyz/toreversed/) (Node 20+)
- Create your own new array using [JavaScript `.filter(entry => entry).reverse()`](https://doesitmutate.xyz/toreversed/)
- [Liquid’s `reverse` filter](https://liquidjs.com/filters/reverse.html)
- [Nunjucks’ `reverse` filter](https://mozilla.github.io/nunjucks/templating.html#reverse)

### Overriding Content Dates

You can modify how a piece of content is sorted in a collection by changing its default `date`. [Read more at Content Dates](https://local.source/docs/dates/).

```
---
date: 2016-01-01
---
```

## Advanced: Custom Filtering and Sorting

This part of the docs has moved to its own page: [Collections API](https://local.source/docs/collections-api/)

×99 resources via **[11tybundle.dev](https://11tybundle.dev/)** curated by [![Favicon for v1.indieweb-avatar.11ty.dev/https%3A%2F%2Fwww.bobmonsour.com%2F](https://v1.indieweb-avatar.11ty.dev/https%3A%2F%2Fwww.bobmonsour.com%2F/)Bob Monsour](https://www.bobmonsour.com/).

**_Expand to see 94 more resources._**

---

### Other pages in Configure Templates with Data

- [Permalinks](https://local.source/docs/permalinks/)

- [Layouts](https://local.source/docs/layouts/)

- [Collections](https://local.source/docs/collections/)
  - [Collections API](https://local.source/docs/collections-api/)

- [Content Dates](https://local.source/docs/dates/)

- [Create Pages From Data](https://local.source/docs/pages-from-data/)

  - [Pagination](https://local.source/docs/pagination/)
  - [Pagination Navigation](https://local.source/docs/pagination/nav/)
