// Eleventy plugins registry
import EleventyVitePlugin from '@11ty/eleventy-plugin-vite'
import EleventyPluginNavigation from '@11ty/eleventy-navigation'
import EleventyPluginRss from '@11ty/eleventy-plugin-rss'
import EleventyPluginSyntaxhighlight from '@11ty/eleventy-plugin-syntaxhighlight'
import interlinker from '@photogabble/eleventy-plugin-interlinker'
import schema from '@quasibit/eleventy-plugin-schema'
import sitemap from '@quasibit/eleventy-plugin-sitemap'

export function registerPlugins(eleventyConfig) {
  eleventyConfig.addPlugin(EleventyVitePlugin)
  eleventyConfig.addPlugin(EleventyPluginNavigation)
  eleventyConfig.addPlugin(EleventyPluginRss)
  eleventyConfig.addPlugin(EleventyPluginSyntaxhighlight)
  eleventyConfig.addPlugin(interlinker)
  eleventyConfig.addPlugin(schema)
  eleventyConfig.addPlugin(sitemap)
}
