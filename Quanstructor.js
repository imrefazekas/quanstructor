let { defined } = require('./lib/Statics')
let { BaseErrors } = require('./lib/Errors')

let _ = require('isa.js')
const Assigner = require('assign.js')
const v = require('vindication.js')

let assign = Object.assign

const QUALITY_SPACE = ''

const SEPARATOR = ','

const PRIMUS = 'PRIMUS'

const Q_TYPE_ATTR = '_qtype'

const DEFINITIONS = { }
const QUANSTRUCTORS = { }

let IGNORE_VALIDATION = false

let PROPERTIES_TO_IGNORE = [ '_allowNull', '_reform', '_preserve', '_derivations', Q_TYPE_ATTR ]

function Quanstructor (name, specs = {}, ...derivations) {
	this.assigner = new Assigner()

	this.name = name

	this._keepQType = false

	this.projections = { complete: [] }

	this._derivations = [ PRIMUS ]
	this._derivations.push( ...derivations )

	this.specs = { }

	this.expand( ...this._derivations )
	this.expand( specs )

	this._viewProxy = false

	this._tune()
}

let PROTO_CACHE = {}

let quanstructor = Quanstructor.prototype
assign( quanstructor, {
	keepQType (keep = true) {
		this._keepQType = keep
		return this
	},
	viewProxies ( view ) {
		this._viewProxy = !!view
		return this
	},
	_addToSpace ( space, key ) {
		if ( !this.views[ space ] )
			this.views[ space ] = []
		this.views[ space ].pushUnique( key )
		return this
	},
	async _buildKnown ( key, value, space = QUALITY_SPACE, target ) {
		if ( !this.attributes.includes(key) ) return
		if ( !this.views[ space ].includes(key) ) return

		let fvalue = this.specs[ key ].revert ? await this.specs[ key ].revert( value ) : value
		if ( this.specs[ key ]._allowNull || defined( fvalue ) )
			target[ key ] = fvalue
		return this
	},
	_protify () {
		DEFINITIONS[ this.name ] = this.specs
		QUANSTRUCTORS[ this.name ] = this
		return this
	},
	_findQ ( qRef, obj = {} ) {
		let refs = qRef.split( SEPARATOR ).map( (ref) => { return ref.trim() } ).filter( (ref) => { return ref } )
		if ( refs.length < 2 ) return qRef
		return obj[ Q_TYPE_ATTR ] || refs[0]
	},
	_tune () {
		let self = this

		for (let key in this.specs) {
			if ( !this.specs[key].spaces )
				this.specs[key].spaces = [ ]
			if ( this.specs[key].space ) {
				this.specs[key].spaces.pushUnique( this.specs[key].space )
				delete this.specs[key].space
			}
			if ( this.specs[key].spaces.length === 0 )
				this.specs[key].spaces.pushUnique( QUALITY_SPACE )
		}

		this.attributes = Object.keys( this.specs ).filter( (prop) => { return !PROPERTIES_TO_IGNORE.includes( prop ) } )
		this.assigner.excluded( this.attributes )

		this.spaces = [ ]
		this.views = { }

		this.hasProxy = this.attributes.find( (attrib) => {
			return self.specs[ attrib ] && self.specs[ attrib ].Proxy
		} )

		for (let key of this.attributes) {
			for (let space of this.specs[key].spaces ) {
				this.spaces.pushUnique( space )
				this.projections.complete.pushUnique( space )

				this._addToSpace( space, key )
			}
		}
		this._protify()
		return this
	},
	expand (...specs) {
		for (let spec of specs) {
			let sSpec = _.isString(spec) ? DEFINITIONS[ spec ] : spec
			for (let key in sSpec)
				this.specs[key] = sSpec[key]
		}
		this._tune()
		return this
	},
	project (name, spaces = []) {
		this.projections[name] = spaces
		return this
	},
	validation ( ) {
		let valid = {}
		for (let prop of this.attributes)
			if ( this.specs[ prop ].validation )
				valid[prop] = this.specs[ prop ].validation
		return valid
	},
	validate ( obj ) {
		let self = this
		for (let prop in self.specs) {
			if ( self.specs[ prop ].Proxy ) continue

			if ( self.specs[ prop ].Quanstructor && obj[ prop ] ) {
				_.isArray( obj[ prop ] )
					? obj[ prop ].map( (item) => {
						return QUANSTRUCTORS[ self._findQ( self.specs[ prop ].Quanstructor, item ) ].validate( item )
					} )
					: QUANSTRUCTORS[ self._findQ( self.specs[ prop ].Quanstructor, obj[prop]) ].validate( obj[prop] )
			}

			if ( !self.specs[ prop ].validation ) continue

			let constraint = {}
			constraint[ prop ] = self.specs[ prop ].validation
			let res = v.validate( obj, constraint )
			// let res = v.validate( obj[prop], this.specs[ prop ].validation )
			if (res && Object.keys(res).length > 0 )
				throw BaseErrors.FailedSchemaValidation( { schema: self.name, property: prop, validation: JSON.stringify(res) } )
		}
		return obj
	},

	Proxifier (obj) {
		let self = this
		return this.hasProxy ? new Proxy(obj, {
			get: function (obj, prop) {
				let def = self.specs[ prop ] && self.specs[ prop ].Proxy
				return def ? def( obj ) : obj[ prop ]
			}
		}) : obj
	},

	async build ( obj, projection = 'complete', options = {} ) {
		options.foldArray = true

		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let self = this
		let res = { }
		for (let attrib of self.attributes) {
			if ( self.specs[ attrib ].Proxy ) continue

			if ( self.specs[ attrib ].Quanstructor ) {
				res[ attrib ] = !obj[ attrib ]
					? ( _.isArray( self.specs[ attrib ].default ) ? [] : ( self.specs[ attrib ].default === null ? null : await QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor ) ].proto( projection, options ) ) )
					: (_.isArray( obj[ attrib ] ) ? await Promise.all(
						obj[ attrib ].map( (item) => {
							return QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor, item ) ].build( item, projection, options )
						} )
					) : await QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor, obj[ attrib ] ) ].build( obj[ attrib ], projection, options ))
			} else {
				let value = obj[attrib] || ( self.specs[ attrib ].hasOwnProperty('default') ? (_.isFunction( self.specs[ attrib ].default ) ? self.specs[ attrib ].default() : self.assigner.cloneObject( self.specs[ attrib ].default )) : v.defaultValue( self.specs[ attrib ].validation ) )
				if ( self.specs[ attrib ]._allowNull || defined(value) )
					res[ attrib ] = value
			}
		}
		for (let space of self.projections[ projection ] ) {
			if ( obj[ space ] )
				for (let attrib of self.views[ space ] ) {
					if ( defined( obj[ space ][ attrib ] ) )
						res[ attrib ] = obj[ space ][ attrib ]
				}
		}

		res[ Q_TYPE_ATTR ] = this.name
		if ( !options.ignorePreserve ) {
			for ( let sup of self._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._preserve )
					await DEFINITIONS[ sup ]._preserve( res, projection, options )
			if ( self.specs._preserve )
				await self.specs._preserve( res, projection, options )
		}

		if ( !IGNORE_VALIDATION && !options.ignoreValidation ) {
			self.validate( res )
		}

		let proxified = self.Proxifier( res )
		// proxified[ Q_TYPE_ATTR ] = this.name
		return proxified
	},

	async umbra (obj, projection = 'complete', caster, options = {}) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let qobject = obj[ Q_TYPE_ATTR ] ? obj : await this.build( obj, projection, options )

		let self = this
		let res = { }
		for (let attrib of self.attributes) {
			if ( self.specs[ attrib ].Proxy ) continue

			res[ attrib ] = await caster( attrib, qobject[ attrib ], qobject, res )
		}

		res = await caster( '', qobject, qobject, res )

		return res
	},

	async bridge ( obj, projection = 'complete', view = 'complete', options = {} ) {
		let res = await this.build( obj, projection, options )

		let final = await this.viewAs( res, view, options )

		this.assigner.assign( final, obj )

		return final
	},

	async schema ( name, projection = 'complete', options = {} ) {
		let res = await this.proto( projection, options )

		function walk (object, embedded = false) {
			if ( !defined(object) ) return { type: 'object' }
			if ( _.isNumber( object ) ) return { type: 'number' }
			if ( _.isString( object ) ) return { type: 'integer' }
			if ( _.isBoolean( object ) ) return { type: 'boolean' }
			if ( _.isArray( object ) ) return { type: 'array' }
			if ( _.isObject( object ) && embedded && options.flat ) {
				return { type: 'object' }
			}
			if ( _.isObject( object ) ) {
				let sd = embedded ? { } : { title: name, type: 'object', properties: { } }
				let props = embedded ? sd : sd.properties
				for (let key in object)
					props[ key ] = walk( object[key], true )
				return sd
			}
			else return { type: 'object' }
		}

		return walk( res, false )
	},

	async derive ( obj, projection = 'complete', options = {} ) {
		return this.bridge( obj, projection, options.view || projection, options )
	},
	async proto ( projection = 'complete', options = {} ) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		if ( PROTO_CACHE[ this.name ] && PROTO_CACHE[ this.name ][projection] ) return assign.cloneObject( PROTO_CACHE[ this.name ][projection] )

		let self = this
		let res = {}
		for (let space of self.projections[ projection ] ) {
			if ( space && !res[ space ] ) res[ space ] = {}
			let ref = !space ? res : res[ space ]
			for (let attrib of self.views[ space ] ) {
				let value = self.specs[ attrib ].hasOwnProperty('default') ? (_.isFunction(self.specs[ attrib ].default) ? self.specs[ attrib ].default() : self.specs[ attrib ].default) : v.defaultValue( this.specs[ attrib ].validation )
				if ( self.specs[ attrib ].Quanstructor ) {
					res[ attrib ] = _.isArray( value )
						? (options.foldArray ? [] : [ await QUANSTRUCTORS[ self._findQ( this.specs[ attrib ].Quanstructor ) ].proto( projection, options ) ])
						: await QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor ) ].proto( projection, options )
				} else {
					if ( self.specs[ attrib ]._allowNull || defined(value) )
						ref[ attrib ] = value
				}
			}
		}

		if ( !options.ignoreReform ) {
			for ( let sup of this._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._reform )
					await DEFINITIONS[ sup ]._reform( res, projection, options )
			if ( this.specs._reform ) await this.specs._reform( res, projection, options )
		}

		if ( !PROTO_CACHE[ this.name ] ) PROTO_CACHE[ this.name ] = {}
		PROTO_CACHE[ this.name ][projection] = res

		return res
	},
	async viewAs ( obj, projection = 'complete', options = {} ) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let self = this
		let res = {}
		for (let space of self.projections[ projection ] ) {
			if ( space && !res[ space ] ) res[ space ] = {}
			let ref = !space ? res : res[ space ]
			for (let attrib of self.views[ space ] ) {
				if ( !self._viewProxy && self.specs[ attrib ].Proxy && !self.specs[ attrib ]._viewProxy ) continue

				let value = self.specs[attrib].convert ? await self.specs[attrib].convert( obj[ attrib ] ) : obj[ attrib ]

				if ( self.specs[ attrib ].Quanstructor ) {
					ref[ attrib ] = _.isArray( value )
						? await Promise.all(
							value.map( (element) => { return QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor, element ) ].viewAs( element, projection, options ) } )
						) : value === null ? null : await QUANSTRUCTORS[ self._findQ( self.specs[ attrib ].Quanstructor, value) ].viewAs( value, projection, options )
				}
				else {
					if ( self.specs[ attrib ]._allowNull || defined(value) )
						ref[ attrib ] = value
				}
			}
		}

		if ( !options.ignoreReform ) {
			for ( let sup of this._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._reform ) {
					await DEFINITIONS[ sup ]._reform( res, projection, options )
				}
			if ( this.specs._reform ) await this.specs._reform( res, projection, options )
		}

		if ( this._keepQType )
			res[ Q_TYPE_ATTR ] = this.name

		return res
	}
} )

module.exports = {
	Q_TYPE_ATTR,
	SEPARATOR,
	QUALITY_SPACE,
	DEFINITIONS,
	QUANSTRUCTORS,
	clearProtoCache () {
		PROTO_CACHE = {}
	},
	ignoreValudation (ignore = false) {
		IGNORE_VALIDATION = !!ignore
	},
	quanstructor (name) {
		return QUANSTRUCTORS[name]
	},
	addPrimus (specs = {}) {
		DEFINITIONS[ PRIMUS ] = specs
	},
	addProto (name, specs = {}) {
		DEFINITIONS[ name ] = specs
	},
	newQuanstructor (name, specs = {}, ...derivations) {
		return new Quanstructor(name, specs, ...derivations)
	}
}
