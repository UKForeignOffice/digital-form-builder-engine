const { Component } = require('.')

class Flashcard extends Component {
  getViewModel () {
    let list = this.model.lists.find(list => list.name === this.options.list)
    let content = list.items.map(item => {
      return {
        title: item.text,
        text: item.description || ''
      }
    })
    return {
      content
    }
  }
}

module.exports = Flashcard
