const boom = require('boom')
const pkg = require('./package.json')
const addressService = require('./address-service')
const Model = require('./model')

module.exports = {
  plugin: {
    name: pkg.name,
    version: pkg.version,
    dependencies: 'vision',
    multiple: true,
    register: (server, options) => {
      const { modelOptions, configs, previewMode } = options

      let hasRootPage = false
      const forms = {}
      configs.forEach(config => {
        forms[config.id] = new Model(config.configuration, {...modelOptions, basePath: config.id})
      })

      if (previewMode) {
        server.route({
          method: 'post',
          path: `/publish`,
          handler: (request, h) => {
            const {id, configuration} = request.payload
            let model = new Model(configuration, modelOptions)
            forms[id] = model
            return h.response({}).code(204)
          }
        })
      }

      server.route({
        method: 'get',
        path: `/{id}/{path*}`,
        handler: (request, h) => {
          const { path, id } = request.params
          let model = forms[id]
          if (!model) {
            return h.response({}).code(404)
          }
          let page = model.pages.find(page => page.path.replace(/^\//,'') === path)
          if (page) {
            return page.makeGetRouteHandler(model.getState)(request, h)
          } else {
            return h.response({}).code(404)
          }
        }
      })

      let handleFiles =  (request, h) => {
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
          pre: [{method: handleFiles}],
          handler: (request, h) => {
            const { path, id } = request.params
            let model = forms[id]
            if (!model) {
              return h.response({}).code(404)
            }
            let page = model.pages.find(page => page.path.replace(/^\//,'') === path)
            if (page) {
              return page.makePostRouteHandler(model.mergeState)(request, h)
            } else {
              return h.response({}).code(404)
            }
          }
        },
      })

      /*
      NOTE:- this should be registered only once, probably not at engine level.
            // FIND ADDRESS
      server.route({
        method: 'get',
        path: '/__/find-address',
        handler: async (request, h) => {
          try {
            const results = await addressService(ordnanceSurveyKey, request.query.postcode)

            return results
          } catch (err) {
            return boom.badImplementation('Failed to find addresses', err)
          }
        },
        options: {
          validate: {
            query: {
              postcode: joi.string().required()
            }
          }
        }
      }) */
    }
  }
}
