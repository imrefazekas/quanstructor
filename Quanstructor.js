let { defined } = require('./lib/Statics')
let { BaseErrors } = require('./lib/Errors')

let _ = require('isa.js')
const Assigner = require('assign.js')
const v = require('vindication.js')

let assign = Object.assign

const QUALITY_SPACE = ''

const PRIMUS = 'PRIMUS'

const DEFINITIONS = { }

let PROPERTIES_TO_IGNORE = [ '_allowNull', '_reform', '_preserve', '_derivations' ]

function Quanstructor (name, specs = {}, ...derivations) {
	this.assigner = new Assigner()

	this.name = name

	this.projections = { complete: [] }

	this._derivations = [PRIMUS]
	this._derivations.push( ...derivations )

	this.specs = { }

	this.expand( ...this._derivations )
	this.expand( specs )

	this._tune()
}

let quanstructor = Quanstructor.prototype
assign( quanstructor, {
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
		return this
	},
	_tune () {
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
		for (let spec of specs)
			this.assigner.assign( this.specs, _.isString(spec) ? DEFINITIONS[ spec ] : spec )
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
		for (let prop in obj) {
			if ( !this.specs[ prop ] || !this.specs[ prop ].validation ) continue

			let res = v.validate( obj[prop], this.specs[ prop ].validation )
			if (res && Object.keys(res).length > 0 )
				throw BaseErrors.FailedSchemaValidation( { schema: this.name, property: prop, validation: JSON.stringify(res) } )
		}
		return obj
	},
	async build ( obj, projection = 'complete', options = {} ) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let res = { }
		for (let attrib of this.attributes) {
			let value = obj[attrib] || ( this.specs[ attrib ].hasOwnProperty('default') ? this.assigner.cloneObject( this.specs[ attrib ].default ) : v.defaultValue( this.specs[ attrib ].validation ) )
			if ( this.specs[ attrib ]._allowNull || defined(value) )
				res[ attrib ] = value
		}
		for (let space of this.projections[ projection ] ) {
			if ( obj[ space ] )
				for (let attrib of this.views[ space ] ) {
					if ( defined( obj[ space ][ attrib ] ) )
						res[ attrib ] = obj[ space ][ attrib ]
				}
		}

		if ( !options.ignorePreserve ) {
			for ( let sup of this._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._preserve )
					await DEFINITIONS[ sup ]._preserve( res, projection, options )
			if ( this.specs._preserve )
				await this.specs._preserve( res, projection, options )
		}

		if ( !options.ignoreValidation )
			this.validate( res )

		return res
	},
	async bridge ( obj, projection = 'complete', view = 'complete', options = {} ) {
		let res = await this.build( obj, projection, options )

		let final = await this.viewAs( res, view, options )

		this.assigner.assign( final, obj )

		return final
	},
	async derive ( obj, projection = 'complete', options = {} ) {
		return this.bridge( obj, projection, options.view || projection, options )
	},
	async proto ( projection = 'complete', options = {} ) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let res = {}
		for (let space of this.projections[ projection ] ) {
			if ( space && !res[ space ] ) res[ space ] = {}
			let ref = !space ? res : res[ space ]
			for (let attrib of this.views[ space ] ) {
				let value = this.specs[ attrib ].hasOwnProperty('default') ? this.specs[ attrib ].default : v.defaultValue( this.specs[ attrib ].validation )
				if ( this.specs[ attrib ]._allowNull || defined(value) )
					ref[ attrib ] = value
			}
		}

		if ( !options.ignoreReform ) {
			for ( let sup of this._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._reform )
					await DEFINITIONS[ sup ]._reform( res, projection, options )
			if ( this.specs._reform ) await this.specs._reform( res, projection, options )
		}

		return res
	},
	async viewAs ( obj, projection = 'complete', options = {} ) {
		if ( !this.projections[projection] )
			throw BaseErrors.InvalidProjection( { projection: projection } )

		let res = {}
		for (let space of this.projections[ projection ] ) {
			if ( space && !res[ space ] ) res[ space ] = {}
			let ref = !space ? res : res[ space ]
			for (let attrib of this.views[ space ] ) {
				let value = this.specs[attrib].convert ? await this.specs[attrib].convert( obj[ attrib ] ) : obj[ attrib ]
				if ( this.specs[ attrib ]._allowNull || defined(value) )
					ref[ attrib ] = value
			}
		}

		if ( !options.ignoreReform ) {
			for ( let sup of this._derivations )
				if ( DEFINITIONS[ sup ] && DEFINITIONS[ sup ]._reform )
					await DEFINITIONS[ sup ]._reform( res, projection, options )
			if ( this.specs._reform ) await this.specs._reform( res, projection, options )
		}

		return res
	}
} )

module.exports = {
	QUALITY_SPACE,
	DEFINITIONS,
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
