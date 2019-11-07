const { FormComponent } = require('.')
const helpers = require('./helpers')

class FileUploadField extends FormComponent {
  getFormSchemaKeys () {
    return helpers.getFormSchemaKeys(this.name, 'string', this)
  }

  getStateSchemaKeys () {
    return helpers.getStateSchemaKeys(this.name, 'string', this)
  }

  getViewModel (formData, errors) {
    const { name, items } = this
    const viewModel = super.getViewModel(formData, errors)
    return viewModel
  }

  get dataType() {
    return 'file'
  }
}

module.exports = FileUploadField
