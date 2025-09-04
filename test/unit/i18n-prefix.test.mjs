import assert from 'node:assert';
import { createResolvers } from '../../lib/interlinkers/resolvers.mjs';
import { routeRegistry } from '../../lib/interlinkers/route-registry.mjs';

test('i18n: locale prefix applies when enabled and locale differs', () => {
  const prev = { enabled: routeRegistry.localePrefixEnabled, def: routeRegistry.defaultLocale };
  routeRegistry.localePrefixEnabled = true;
  routeRegistry.defaultLocale = 'en';
  const resolvers = createResolvers();
  const currentPage = { data: { locale: 'zh' } };
  const html = resolvers.get('product')({ name: 'best-of-luck' }, currentPage);
  assert(/href="\/zh\/archives\/product\//.test(html), 'prefixed with /zh/');
  // revert
  routeRegistry.localePrefixEnabled = prev.enabled;
  routeRegistry.defaultLocale = prev.def;
});

