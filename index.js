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
      const { modelOptions, configs } = options

      let hasRootPage = false
      const forms = {}
      configs.forEach(config => {
        forms[config.id] = new Model(config.configuration, {...modelOptions, basePath: config.id})
      })

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

      server.route({
        method: 'get',
        path: `/{id}/{path*}`,
        handler: (request, h) => {
          const { path, id } = request.params
          let model = forms[id]
          if (!model) {
            console.log('oops')
          }
          let page = model.pages.find(page => page.path.replace(/^\//,'') === path)
          if (page) {
            return page.makeGetRouteHandler(model.getState)(request, h)
          } else {
            console.log('err')
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
            maxBytes: Number.MAX_SAFE_INTEGER,
            failAction: 'ignore'
          },
          pre: [{method: handleFiles}],

          handler: (request, h) => {
            const { path, id } = request.params
            let model = forms[id]
            if (!model) {
              console.log('oops')
            }
            let page = model.pages.find(page => page.path.replace(/^\//,'') === path)
            if (page) {
              return page.makePostRouteHandler(model.mergeState)(request, h)
            } else {
              console.log('err')
            }
          }
        },

      })


      /*model.pages.forEach(page => {
        // GET
        let route = page.makeGetRoute(model.getState)
        let path = route.path
        if (path === '/') {
          hasRootPage = true
        }
        if (route.path) {
          path = path !== '/' ? path.replace(/^/, `/${basePath}`) : `/${basePath}`
        }
        route.path = path
        server.route(route)

        // POST
        if (page.hasFormComponents) {
          let postPath = page.makePostRoute(model.mergeState)
          postPath.path = path
          server.route(postPath)
        }
      })

      if (!hasRootPage) {
        server.route({
          method: 'get',
          path: `/${basePath}`,
          handler: (request, h) => {
            let startPageRedirect = h.redirect(`/${basePath}${model.def.pages[0].path}`)
            let startPage = model.def.startPage
            if (startPage.startsWith('http')) {
              startPageRedirect = h.redirect(startPage)
            } else if (model.def.pages.find(page => page.path === startPage)) {
              startPageRedirect = h.redirect(`/${basePath}${startPage}`)
            }
            return startPageRedirect
          }
        })
      }*/

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
