---
layout: "layouts/converted-html.njk"
title: "Data Cascade"
excerpt: "A docs page for Eleventy, a simpler static site generator."
sourcePath: "./src/content/docs/knowledge/eleventy-data-cascade-20250911T175348Z.html"
readabilityLength: 1955
convertedFromHtml: true
---
Breadcrumbs:

- [Eleventy Documentation](https://local.source/docs/)
- [Guide](https://local.source/docs/projects/)
- [Using Data in Templates](https://local.source/docs/data/)

On this page

- [Sources of Data](#sources-of-data)
- [Example](#example)
- [From the Community](#from-the-community)

In Eleventy, data is merged from multiple different sources before the template is rendered. The data is merged in what Eleventy calls the Data Cascade.

## Sources of Data

When the data is merged in the Eleventy Data Cascade, the order of priority for sources of data is (from highest priority to lowest):

1. [Computed Data](https://local.source/docs/data-computed/)
2. [Front Matter Data in a Template](https://local.source/docs/data-frontmatter/)
3. [Template Data Files](https://local.source/docs/data-template-dir/)
4. [Directory Data Files (and ascending Parent Directories)](https://local.source/docs/data-template-dir/)
5. [Front Matter Data in Layouts](https://local.source/docs/layouts/#front-matter-data-in-layouts) _(this [moved in 1.0](https://github.com/11ty/eleventy/issues/915))_
6. [Configuration API Global Data](https://local.source/docs/data-global-custom/)
7. [Global Data Files](https://local.source/docs/data-global/)

## Example

**Filename&#x20;**&#x6D;y-template.md

```
---
title: This is a Good Blog Post
tags:
  - CSS
  - HTML
layout: my-layout.njk
---
```

**Filename&#x20;**\_includes/my-layout.njk

```
---
title: This is a Very Good Blog Post
author: Zach
tags:
  - JavaScript
---
```

Note that when `my-template.md` and `my-layout.njk` share data with the same object key (`title` and `tags`), the “leaf template” `my-template.md` takes precedence.

The data cascade results in the following data when `my-template.md` is rendered:

**Syntax&#x20;**&#x4A;avaScript

```
{
	"title": "This is a Good Blog Post",
	"author": "Zach",
	"tags": ["CSS", "HTML", "JavaScript"],
	"layout": "my-layout.njk"
}
```

By default in v1.0, Eleventy does a deep data merge to combine Object literals and Arrays. If you want to opt-out of this behavior and revert to a simple top level merge (`Object.assign`) from the different data sources, you can turn off [Data Deep Merge](https://local.source/docs/data-deep-merge/). You can override this on a per-property basis too—read more at the [Data Deep Merge documentation](https://local.source/docs/data-deep-merge/).

×48 resources via **[11tybundle.dev](https://11tybundle.dev/)** curated by [![Favicon for v1.indieweb-avatar.11ty.dev/https%3A%2F%2Fwww.bobmonsour.com%2F](https://v1.indieweb-avatar.11ty.dev/https%3A%2F%2Fwww.bobmonsour.com%2F/)Bob Monsour](https://www.bobmonsour.com/).

**_Expand to see 43 more resources._**

---

### Other pages in Using Data

- [Eleventy Supplied Data](https://local.source/docs/data-eleventy-supplied/)

- [Data Cascade](https://local.source/docs/data-cascade/)

  - [Front Matter Data](https://local.source/docs/data-frontmatter/)
    - [Custom Front Matter](https://local.source/docs/data-frontmatter-customize/)
  - [Template & Directory Data Files](https://local.source/docs/data-template-dir/)
  - [Global Data Files](https://local.source/docs/data-global/)
  - [Config Global Data](https://local.source/docs/data-global-custom/)
  - [Computed Data](https://local.source/docs/data-computed/)

- [JavaScript Data Files](https://local.source/docs/data-js/)

- [Custom Data File Formats](https://local.source/docs/data-custom/)

- [Validate Data](https://local.source/docs/data-validate/)
