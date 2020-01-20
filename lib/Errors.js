const {inherits} = require('util')

let Assigner = require('assign.js')
let assigner = new Assigner()

let _ = require('isa.js')

let CustomError = function (message, errorName, errorCode) {
	this.message = message
	this.errorName = errorName
	this.errorCode = errorCode
	Error.captureStackTrace(this, CustomError)
}
inherits(CustomError, Error)

function templating (string, ...parameters) {
	let options = parameters.length === 1 && _.isObject( parameters[0] ) ? parameters[0] : parameters

	return string.replace(/\{([0-9a-zA-Z_]+)\}/g, (match, i, index) => {
		if (string[index - 1] === '{' &&
			string[index + match.length] === '}') {
			return i
		} else {
			return options.hasOwnProperty(i) && options[i] ? options[i] : ''
		}
	})
}

let ErrorCreator = function (options = {}) {
	let errorCode = options.errorCode
	let args = assigner.assign({}, options)
	delete args['message']
	delete args['code']
	delete args['errorCode']
	let fnc = function (opts = {}) {
		let newArgs = assigner.assign({}, args, opts)
		let message = templating(options.message, newArgs)
		let resultError = new CustomError(message, options.errorName || errorCode, errorCode)
		resultError.params = newArgs
		return resultError
	}
	return fnc
}

let BaseErrors = {
	// Schema Errors
	FailedSchemaValidation: ErrorCreator( {
		errorCode: 16000,
		errorName: 'FailedSchemaValidation',
		message: '{schema} failed on schema validation of {property} by {validation}'
	} ),

	InvalidProjection: ErrorCreator( {
		errorCode: 16001,
		errorName: 'InvalidProjection',
		message: 'Projection {projection} is not defined'
	} )
}

module.exports = { CustomError, ErrorCreator, BaseErrors }

