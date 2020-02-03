const Boom = require('boom')
const pkg = require('./package.json')
const Model = require('./model')

function normalisePath (path) {
  return path
    .replace(/^\//, '')
    .replace(/\/$/, '')
}

function getStartPageRedirect (h, id, model) {
  const startPage = normalisePath(model.def.startPage)
  let startPageRedirect
  if (startPage.startsWith('http')) {
    startPageRedirect = h.redirect(startPage)
  } else {
    startPageRedirect = h.redirect(`/${id}/${startPage}`)
  }
  return startPageRedirect
}

module.exports = {
  plugin: {
    name: pkg.name,
    version: pkg.version,
    dependencies: 'vision',
    multiple: true,
    register: (server, options) => {
      const { modelOptions, configs, previewMode } = options
      /*
      * This plugin cannot be run outside of the context of the https://github.com/UKForeignOffice/digital-form-builder project.
      * Ideally the engine encapsulates all the functionality required to run a form so work needs to be done to merge functionality
      * from the builder project.
      **/
      const forms = {}
      configs.forEach(config => {
        forms[config.id] = new Model(config.configuration, { ...modelOptions, basePath: config.id })
      })

      if (previewMode) {
        server.route({
          method: 'post',
          path: `/publish`,
          handler: (request, h) => {
            const { id, configuration } = request.payload
            forms[id] = new Model(configuration, modelOptions)
            return h.response({}).code(204)
          }
        })
      }

      server.route({
        method: 'get',
        path: `/{id}`,
        handler: (request, h) => {
          const { id } = request.params
          const model = forms[id]
          if (model) {
            return getStartPageRedirect(h, id, model)
          }
          throw Boom.notFound('No form found for id')
        }
      })

      server.route({
        method: 'get',
        path: `/{id}/{path*}`,
        handler: (request, h) => {
          const { path, id } = request.params
          const model = forms[id]
          if (model) {
            const page = model.pages.find(page => normalisePath(page.path) === normalisePath(path))
            if (page) {
              return page.makeGetRouteHandler()(request, h)
            }
            if (normalisePath(path) === '') {
              return getStartPageRedirect(h, id, model)
            }
          }
          throw Boom.notFound('No form or page found')
        }
      })

      const handleFiles = (request, h) => {
        let { uploadService } = request.services([])
        return uploadService.handleUploadRequest(request, h)
      }

      server.route({
        method: 'post',
        path: `/{id}/{path*}`,
        config: {
          payload: {
            output: 'stream',
            parse: true,
            maxBytes: 5e+6,
            failAction: 'ignore'
          },
          pre: [{ method: handleFiles }],
          handler: (request, h) => {
            const { path, id } = request.params
            const model = forms[id]
            if (model) {
              const page = model.pages.find(page => page.path.replace(/^\//, '') === path)
              if (page) {
                return page.makePostRouteHandler()(request, h)
              }
            }
            throw Boom.notFound('No form of path found')
          }
        }
      })
    }
  }
}
