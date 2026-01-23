import path from 'node:path'

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  imageAttributesToPosthtmlNode,
  getOutputDirectory,
  cleanTag,
  isIgnored,
  isOptional,
} = require('@11ty/eleventy-img/src/image-attrs-to-posthtml-node.js')
const { getGlobalOptions } = require('@11ty/eleventy-img/src/global-options.js')
const {
  eleventyImageOnRequestDuringServePlugin,
} = require('@11ty/eleventy-img/src/on-request-during-serve-plugin.js')
const { Util: eleventyImageUtil } = require('@11ty/eleventy-img')

const PROTOCOL_RELATIVE_REMOTE = /^\/\//

const PLACEHOLDER_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='

const ATTRS = {
  ORIGINAL_SOURCE: 'eleventy:internal_original_src',
}

function getSrcAttributeValue(sourceNode) {
  return sourceNode.attrs?.src
}

function assignAttributes(rootTargetNode, newNode) {
  if (rootTargetNode.tag !== newNode.tag) {
    delete rootTargetNode.attrs
  }

  if (!rootTargetNode.attrs) {
    rootTargetNode.attrs = {}
  }

  if (newNode.attrs) {
    Object.assign(rootTargetNode.attrs, newNode.attrs)
  }
}

function getOutputLocations(originalSource, outputDirectoryFromAttribute, pageContext, options) {
  const projectOutputDirectory = options.directories.output

  if (outputDirectoryFromAttribute) {
    if (path.isAbsolute(outputDirectoryFromAttribute)) {
      return {
        outputDir: path.join(projectOutputDirectory, outputDirectoryFromAttribute),
        urlPath: outputDirectoryFromAttribute,
      }
    }

    return {
      outputDir: path.join(projectOutputDirectory, pageContext.url, outputDirectoryFromAttribute),
      urlPath: path.join(pageContext.url, outputDirectoryFromAttribute),
    }
  }

  if (options.urlPath) {
    return {}
  }

  if (path.isAbsolute(originalSource)) {
    return {
      outputDir: path.join(projectOutputDirectory, '/img/'),
      urlPath: '/img/',
    }
  }

  const dir = path.dirname(pageContext.outputPath)

  if (pageContext.outputPath.endsWith(pageContext.url)) {
    const split = pageContext.url.split('/')
    split[split.length - 1] = ''

    return {
      outputDir: dir,
      urlPath: split.join('/'),
    }
  }

  return {
    outputDir: dir,
    urlPath: pageContext.url,
  }
}

function isRemoteSource(value) {
  if (typeof value !== 'string') {
    return false
  }

  return PROTOCOL_RELATIVE_REMOTE.test(value) || eleventyImageUtil.isRemoteUrl(value)
}

function transformTag(context, sourceNode, rootTargetNode, opts) {
  const originalSource = getSrcAttributeValue(sourceNode)

  if (!originalSource) {
    return sourceNode
  }

  if (isRemoteSource(originalSource)) {
    cleanTag(sourceNode)
    return sourceNode
  }

  const { inputPath } = context.page

  sourceNode.attrs.src = eleventyImageUtil.normalizeImageSource(
    {
      input: opts.directories.input,
      inputPath,
    },
    originalSource,
    {
      isViaHtml: true,
    },
  )

  if (sourceNode.attrs.src !== originalSource) {
    sourceNode.attrs[ATTRS.ORIGINAL_SOURCE] = originalSource
  }

  const outputDirectoryFromAttribute = getOutputDirectory(sourceNode)
  const instanceOptions = getOutputLocations(
    originalSource,
    outputDirectoryFromAttribute,
    context.page,
    opts,
  )

  return imageAttributesToPosthtmlNode(sourceNode.attrs, instanceOptions, opts).then(
    (newNode) => {
      assignAttributes(rootTargetNode, newNode)
      rootTargetNode.tag = newNode.tag
      rootTargetNode.content = newNode.content
    },
    (error) => {
      if (isOptional(sourceNode) || !opts.failOnError) {
        if (isOptional(sourceNode, 'keep')) {
          if (sourceNode.attrs[ATTRS.ORIGINAL_SOURCE]) {
            sourceNode.attrs.src = sourceNode.attrs[ATTRS.ORIGINAL_SOURCE]
          }
        } else if (isOptional(sourceNode, 'placeholder')) {
          sourceNode.attrs.src = PLACEHOLDER_DATA_URI
        } else if (isOptional(sourceNode)) {
          delete sourceNode.attrs.src
        }

        cleanTag(sourceNode)

        return Promise.resolve()
      }

      return Promise.reject(error)
    },
  )
}

export function localImageTransformPlugin(eleventyConfig, options = {}) {
  const mergedOptions = {
    extensions: 'html',
    transformOnRequest: process.env.ELEVENTY_RUN_MODE === 'serve',
    ...options,
  }

  if (mergedOptions.transformOnRequest !== false) {
    eleventyConfig.addPlugin(eleventyImageOnRequestDuringServePlugin)
  }

  const opts = getGlobalOptions(eleventyConfig, mergedOptions, 'transform')

  eleventyConfig.addJavaScriptFunction(
    '__private_eleventyImageTransformConfigurationOptions',
    () => opts,
  )

  function posthtmlPlugin(context) {
    return async (tree) => {
      const promises = []
      const match = tree.match

      tree.match({ tag: 'picture' }, (pictureNode) => {
        match.call(pictureNode, { tag: 'img' }, (imgNode) => {
          imgNode._insideOfPicture = true

          if (!isIgnored(imgNode) && !imgNode?.attrs?.src?.startsWith('data:')) {
            promises.push(transformTag(context, imgNode, pictureNode, opts))
          }

          return imgNode
        })

        return pictureNode
      })

      tree.match({ tag: 'img' }, (imgNode) => {
        if (imgNode._insideOfPicture) {
          delete imgNode._insideOfPicture
        } else if (isIgnored(imgNode) || imgNode?.attrs?.src?.startsWith('data:')) {
          cleanTag(imgNode)
        } else {
          promises.push(transformTag(context, imgNode, imgNode, opts))
        }

        return imgNode
      })

      await Promise.all(promises)

      return tree
    }
  }

  if (!eleventyConfig.htmlTransformer || !('addPosthtmlPlugin' in eleventyConfig.htmlTransformer)) {
    throw new Error(
      '[@11ty/eleventy-img] `localImageTransformPlugin` is not compatible with this version of Eleventy. You will need to use v3.0.0 or newer.',
    )
  }

  eleventyConfig.htmlTransformer.addPosthtmlPlugin(mergedOptions.extensions, posthtmlPlugin, {
    priority: -1,
  })
}

export default localImageTransformPlugin
