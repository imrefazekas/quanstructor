Array.prototype.pushUnique = function (...items) {
	for (let item of items)
		if (!this.includes(item)) this.push( item )
	return this
}

let Proxyfier = require('./Proxyfier')

module.exports = {
	defined (value) {
		return value !== undefined && value !== null
	},
	Proxyfier
}
