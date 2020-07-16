const PROPERTY_PRIM = '__primValue'

module.exports = (object, value) => {
	const handler = {
		getPrototypeOf (target) {
			return Number.prototype
		},
		get (obj, prop) {
			if (prop === 'valueOf') return () => {
				return obj[PROPERTY_PRIM]
			}
			if (prop === 'toString') return () => {
				return obj[PROPERTY_PRIM].toString()
			}
			return prop in obj ? obj[prop] : 37
		}
	}
	Object.assign( object, {
		[Symbol.toPrimitive] (hint) {
			if (hint === 'number') {
				return this[PROPERTY_PRIM]
			}
			if (hint === 'string') {
				return this[PROPERTY_PRIM]
			}
			if (hint === 'default') {
				return this[PROPERTY_PRIM]
			}
			return true
		}
	} )
	object[PROPERTY_PRIM] = value

	return new Proxy( object, handler )
}
