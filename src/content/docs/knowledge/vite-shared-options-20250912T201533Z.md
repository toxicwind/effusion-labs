## resolve.alias

- **Type:**
  `Record<string, string> | Array<{ find: string | RegExp, replacement: string, customResolver?: ResolverFunction | ResolverObject }>`

Will be passed to `@rollup/plugin-alias` as its [entries option](https://github.com/rollup/plugins/tree/master/packages/alias#entries). Can either be an object, or an array of `{ find, replacement, customResolver }` pairs.

When aliasing to file system paths, always use absolute paths. Relative alias values will be used as-is and will not be resolved into file system paths.

More advanced custom resolution can be achieved through [plugins](/guide/api-plugin).

::: warning Using with SSR
If you have configured aliases for [SSR externalized dependencies](/guide/ssr.md#ssr-externals), you may want to alias the actual `node_modules` packages. Both [Yarn](https://classic.yarnpkg.com/en/docs/cli/add/#toc-yarn-add-alias) and [pnpm](https://pnpm.io/aliases/) support aliasing via the `npm:` prefix.
:::
