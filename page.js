const joi = require('joi')
const { proceed } = require('./helpers')
const { ComponentCollection } = require('./components')

const FORM_SCHEMA = Symbol('FORM_SCHEMA')
const STATE_SCHEMA = Symbol('STATE_SCHEMA')

class Page {
  constructor (model, pageDef) {
    const { def } = model

    // Properties
    this.def = def
    this.model = model
    this.pageDef = pageDef
    this.path = pageDef.path
    this.title = pageDef.title
    this.condition = pageDef.condition

    // Resolve section
    const section = pageDef.section &&
      model.sections.find(s => s.name === pageDef.section)

    this.section = section

    // Components collection
    const components = new ComponentCollection(pageDef.components, model)
    this.components = components
    const conditionalFormComponents = components.formItems.filter(c => c.conditionalComponents)
    // this.hasFormComponents = !!components.formItems.length
    this.hasFormComponents = true
    this.hasConditionalFormComponents = !!conditionalFormComponents.length

    // Schema
    this[FORM_SCHEMA] = this.components.formSchema
    this[STATE_SCHEMA] = this.components.stateSchema
  }

  getViewModel (formData, errors) {
    let showTitle = true
    let pageTitle = this.title
    const sectionTitle = this.section && this.section.title
    const components = this.components.getViewModel(formData, errors)
    const formComponents = components.filter(c => c.isFormComponent)
    const hasSingleFormComponent = formComponents.length === 1
    const singleFormComponent = hasSingleFormComponent && formComponents[0]
    const singleFormComponentIsFirst = singleFormComponent && singleFormComponent === components[0]

    if (hasSingleFormComponent && singleFormComponentIsFirst) {
      const label = singleFormComponent.model.label

      if (this.section) {
        label.html =
          `<span class="govuk-caption-xl">${this.section.title}</span> ${label.text}`
      }

      label.isPageHeading = true
      label.classes = 'govuk-label--xl'
      pageTitle = label.text
      showTitle = false
    }

    return { page: this, pageTitle, sectionTitle, showTitle, components, errors }
  }
  get hasNext () {
    return Array.isArray(this.pageDef.next) && this.pageDef.next.length > 0
  }
  get next () {
    if (this.hasNext) {
      const nextPagePaths = this.pageDef.next.map(next => next.path)
      return this.def.pages.filter(page => {
        return nextPagePaths.includes(page.path)
      })
    }
  }

  getNext (state) {
    if (this.hasNext) {
      let nextPageWithoutCondition = this.next.find(page => {
        return !page.condition
      }) || this.defaultNextPath

      let nextPage = this.next.find(page => {
        const value = page.section ? state[page.section.name] : state

        let condition = this.model.conditions[page.condition]

        const isRequired = page.condition
          ? condition.fn(state)
          : false

        if (isRequired) {
          if (!page.hasFormComponents) {
            return true
          } else {
            const error = joi.validate(value || {}, page.stateSchema.required(), this.model.conditionOptions).error
            const isValid = !error

            return !isValid
          }
        }
      })
      return nextPage ? nextPage.path : nextPageWithoutCondition.path
    } else {
      return this.defaultNextPath
    }
  }

  getFormDataFromState (state) {
    const pageState = this.section ? state[this.section.name] : state
    return this.components.getFormDataFromState(pageState || {})
  }

  getStateFromValidForm (formData) {
    return this.components.getStateFromValidForm(formData)
  }

  getErrors (validationResult) {
    if (validationResult && validationResult.error) {
      return {
        titleText: this.errorSummaryTitle,
        errorList: validationResult.error.details.map(err => {
          const name = err.path.map((name, index) => index > 0 ? `__${name}` : name).join('')

          return {
            path: err.path.join('.'),
            href: `#${name}`,
            name: name,
            text: err.message
          }
        })
      }
    }
  }

  validate (value, schema) {
    const result = joi.validate(value, schema, this.validationOptions)
    const errors = result.error ? this.getErrors(result) : null

    return { value: result.value, errors }
  }

  validateForm (payload) {
    return this.validate(payload, this.formSchema)
  }

  validateState (newState) {
    return this.validate(newState, this.stateSchema)
  }

  langFromRequest (request) {
    let lang = request.query.lang || request.yar.get('lang') || 'en'
    if (lang !== request.yar.get('lang')) {
      request.i18n.setLocale(lang)
      request.yar.set('lang', lang)
    }
    return request.yar.get('lang')
  }

  makeGetRouteHandler (getState) {
    return async (request, h) => {
      let lang = this.langFromRequest(request)
      const state = await getState(request)
      const formData = this.getFormDataFromState(state)
      formData.lang = lang
      let { originalFilenames } = state
      if (originalFilenames) {
        Object.entries(formData).forEach(([key, value]) => {
          if (value && value === (originalFilenames[key] || {}).location) {
            formData[key] = originalFilenames[key].originalFilename
          }
        })
      }
      return h.view(this.viewName, this.getViewModel(formData))
    }
  }

  makePostRouteHandler (mergeState) {
    return async (request, h) => {
      const payload = request.payload
      const preHandlerErrors = request.pre.errors
      let formResult = this.validateForm(payload)
      const state = await this.model.getState(request)
      let originalFilenames = (state || {}).originalFilenames || {}

      //TODO:- Refactor this into a validation method
      if (preHandlerErrors) {
        let fileFields = this.getViewModel(formResult).components.filter(component => component.type === 'FileUploadField').map(component => component.model)
        let reformattedErrors = preHandlerErrors.map(error => {
          let reformatted = error
          let fieldMeta = fileFields.find(field => field.id === error.name)
          reformatted.text = reformatted.text.replace(/%s/, fieldMeta ? fieldMeta.label.text.trim() : 'the file')
          return reformatted
        })
        formResult.errors = Object.is(formResult.errors, null) ? { titleText: "Fix the following errors"} : formResult.errors
        formResult.errors.errorList = formResult.errors.errorList ? [...formResult.errors.errorList, ...reformattedErrors] : reformattedErrors
      }

      if (originalFilenames) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value && value === (originalFilenames[key] || {}).location) {
            payload[key] = originalFilenames[key].originalFilename
          }
        })
      }

      if (formResult.errors) {
        return h.view(this.viewName, this.getViewModel(payload, formResult.errors))
      } else {
        const newState = this.getStateFromValidForm(formResult.value)
        const stateResult = this.validateState(newState)

        if (stateResult.errors) {
          return h.view(this.viewName, this.getViewModel(payload, stateResult.errors))
        } else {
          const update = this.getPartialMergeState(stateResult.value)

          const state = await mergeState(request, update)

          return this.proceed(request, h, state)
        }
      }
    }
  }

  makeGetRoute (getState) {
    return {
      method: 'get',
      path: this.path,
      options: this.getRouteOptions,
      handler: this.makeGetRouteHandler(getState)
    }
  }

  makePostRoute (mergeState) {
    return {
      method: 'post',
      path: this.path,
      options: this.postRouteOptions,
      handler: this.makePostRouteHandler(mergeState)
    }
  }

  proceed (request, h, state) {
    return proceed(request, h, this.getNext(state))
  }

  getPartialMergeState (value) {
    return this.section ? { [this.section.name]: value } : value
  }

  localisedString (description, lang) {
    let string
    if (typeof description === 'string') {
      string = description
    } else {
      string = description[lang]
        ? description[lang]
        : description['en']
    }
    return string
  }

  get viewName () { return 'index' }
  get defaultNextPath () { return '/summary' }
  get validationOptions () { return { abortEarly: false } }
  get conditionOptions () { return this.model.conditionOptions }
  get errorSummaryTitle () { return 'Fix the following errors' }
  get getRouteOptions () { return {} }
  get postRouteOptions () { return {} }
  get formSchema () { return this[FORM_SCHEMA] }
  set formSchema (value) { this[FORM_SCHEMA] = value }
  get stateSchema () { return this[STATE_SCHEMA] }
  set stateSchema (value) { this[STATE_SCHEMA] = value }
}

module.exports = Page
