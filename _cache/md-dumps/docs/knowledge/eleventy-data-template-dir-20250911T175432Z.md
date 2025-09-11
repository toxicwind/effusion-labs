---
layout: "layouts/converted-html.njk"
title: "Template and Directory Data Files"
excerpt: "A docs page for Eleventy, a simpler static site generator."
sourcePath: "./src/content/docs/knowledge/eleventy-data-template-dir-20250911T175432Z.html"
readabilityLength: 2736
convertedFromHtml: true
---
Breadcrumbs:

- [Eleventy Documentation](https://local.source/docs/)
- [Guide](https://local.source/docs/projects/)
- [Using Data in Templates](https://local.source/docs/data/)
- [Data Cascade](https://local.source/docs/data-cascade/)

On this page

- [Examples](#examples)
  - [Apply a default layout to multiple templates](#apply-a-default-layout-to-multiple-templates)
- [Additional Customizations](#additional-customizations)
- [Sources of Data](#sources-of-data)

While you can provide [global data files](https://local.source/docs/data-global/) to supply data to all of your templates, you may want some of your data to be available locally only to one specific template or to a directory of templates. For that use, we also search for JSON and [JavaScript Data Files](https://local.source/docs/data-js/) in specific places in your directory structure.

For example, consider a template located at `posts/subdir/my-first-blog-post.md`. Eleventy will look for data in the following places (starting with highest priority, local data keys override global data):

1. [Content Template Front Matter Data](https://local.source/docs/data-frontmatter/)
   - merged with any [Layout Front Matter Data](https://local.source/docs/layouts/#front-matter-data-in-layouts)

2. Template Data File (data is only applied to `posts/subdir/my-first-blog-post.md`)

   - `posts/subdir/my-first-blog-post.11tydata.js` [JavaScript Data Files](https://local.source/docs/data-js/)
   - `posts/subdir/my-first-blog-post.11tydata.json`
   - `posts/subdir/my-first-blog-post.json`

3. Directory Data File (data applies to all templates in `posts/subdir/*`)

   - `posts/subdir/subdir.11tydata.js` [JavaScript Data Files](https://local.source/docs/data-js/)
   - `posts/subdir/subdir.11tydata.json`
   - `posts/subdir/subdir.json`

4. Parent Directory Data File (data applies to all templates in `posts/**/*`, including subdirectories)

   - `posts/posts.11tydata.js` [JavaScript Data Files](https://local.source/docs/data-js/)
   - `posts/posts.11tydata.json`
   - `posts/posts.json`

5. [Global Data Files](https://local.source/docs/data-global/) in `_data/*` (`.js` or `.json` files) available to all templates.

## Examples

### Apply a default layout to multiple templates

**Filename&#x20;**&#x70;osts/posts.json

```
{ "layout": "layouts/post.njk" }
```

Using the above in `posts/posts.json` will configure a layout for all of the templates inside of `posts/*`.

## Additional Customizations

- The name of the data file must match either the post or the directory it resides within. You can [change this behavior using the `setDataFileBaseName` method in the Configuration API](https://local.source/docs/config/#change-base-file-name-for-data-files).
- You can use the [`setDataFileSuffixes` Configuration API method to **customize the default file suffixes or disable this feature altogether**](https://local.source/docs/config/#change-file-suffix-for-data-files).
- Note that any [Custom Formats](https://local.source/docs/data-custom/#ordering-in-the-data-cascade) specified in your configuration will also be taken into account at a lower priority than their JavaScript or JSON counterparts.

## Sources of Data

When the data is merged in the [Eleventy Data Cascade](https://local.source/docs/data-cascade/), the order of priority for sources of data is (from highest priority to lowest):

1. [Computed Data](https://local.source/docs/data-computed/)
2. [Front Matter Data in a Template](https://local.source/docs/data-frontmatter/)
3. [Template Data Files](https://local.source/docs/data-template-dir/) ⬅
4. [Directory Data Files (and ascending Parent Directories)](https://local.source/docs/data-template-dir/) ⬅
5. [Front Matter Data in Layouts](https://local.source/docs/layouts/#front-matter-data-in-layouts) _(this [moved in 1.0](https://github.com/11ty/eleventy/issues/915))_
6. [Configuration API Global Data](https://local.source/docs/data-global-custom/)
7. [Global Data Files](https://local.source/docs/data-global/)

---

### Other pages in Data Cascade

- [Front Matter Data](https://local.source/docs/data-frontmatter/)
  - [Custom Front Matter](https://local.source/docs/data-frontmatter-customize/)
- [Template & Directory Data Files](https://local.source/docs/data-template-dir/)
- [Global Data Files](https://local.source/docs/data-global/)
- [Config Global Data](https://local.source/docs/data-global-custom/)
- [Computed Data](https://local.source/docs/data-computed/)
