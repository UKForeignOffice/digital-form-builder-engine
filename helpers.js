function proceed (request, h, nextUrl, force) {
  let url = nextUrl
  if (h.realm.pluginOptions.basePath) {
    let basePath = h.realm.pluginOptions.basePath
    url = nextUrl.replace(/^/, `/${basePath}`)
  }

  const returnUrl = request.query.returnUrl
  if (returnUrl) {
    if (force) {
      const hasQuery = ~url.indexOf('?')
      url += (hasQuery ? '&' : '?') + 'returnUrl=' + returnUrl
    } else {
      url = returnUrl
    }
  }

  return h.redirect(url)
}

module.exports = { proceed }
