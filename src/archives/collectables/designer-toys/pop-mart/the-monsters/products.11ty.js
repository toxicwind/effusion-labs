export const data = () => ({
  layout: 'layout.njk',
  eleventyComputed: {
    pagination: (data) => {
      const all = Array.isArray(data.collections?.archiveProducts) ? data.collections.archiveProducts : [];
      const filtered = all.filter(p => (
        p?.data?.companySlug === 'pop-mart' &&
        p?.data?.lineSlug === 'the-monsters' &&
        p?.data?.locale === 'en'
      ));
      return { data: filtered, size: 1, alias: 'product' };
    },
    companySlug: () => 'pop-mart',
    lineSlug: () => 'the-monsters',
    productSlug: ({ product }) => product?.data?.productSlug,
    title: ({ product }) => `POP MART — The Monsters — ${product?.data?.product_id || product?.data?.title || product?.data?.productSlug}`,
    permalink: ({ companySlug, lineSlug, productSlug }) => `/archives/collectables/designer-toys/${companySlug}/${lineSlug}/products/${productSlug}/index.html`,
  },
});

export const render = (data) => `
<nav class="breadcrumbs text-sm mb-2 overflow-x-auto whitespace-nowrap" aria-label="Breadcrumb">
  <ul>
    <li><a href="/archives/">Archives</a></li>
    <li><a href="/archives/collectables/designer-toys/${data.companySlug}/">POP MART</a></li>
    <li><a href="/archives/collectables/designer-toys/${data.companySlug}/${data.lineSlug}/">The Monsters</a></li>
    <li class="opacity-70">${data.product?.data?.product_id || data.product?.data?.title || data.productSlug}</li>
  </ul>
</nav>

<div class="mb-6">
  <a class="btn btn-ghost" href="/archives/collectables/designer-toys/${data.companySlug}/${data.lineSlug}/">&larr; Back</a>
</div>

<header class="mb-6">
  <h1 class="font-heading text-3xl uppercase tracking-[-0.02em] text-primary mb-0">
    ${data.product?.data?.product_id || data.product?.data?.title || data.productSlug}
  </h1>
</header>

<section class="card bg-base-100 border shadow-sm">
  <div class="card-body p-4 sm:p-6">
    {% from "components/products/SpecSheet.njk" import specSheet %}
    {{ specSheet(product) }}
  </div>
</section>
`;

