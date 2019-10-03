const joi = require('joi')
const boom = require('boom')
const pkg = require('./package.json')
const addressService = require('./address-service')

module.exports = {
  plugin: {
    name: pkg.name,
    version: pkg.version,
    dependencies: 'vision',
    multiple: true,
    register: (server, options) => {
      const { model, basePath } = options

      model.pages.forEach(page => {
        // GET
        let route = page.makeGetRoute(model.getState)
        let path = route.path
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
