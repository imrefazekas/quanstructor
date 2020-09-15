const { ignoreValudation, Q_TYPE_ATTR, addPrimus, addProto, newQuanstructor, QUANSTRUCTORS, tuneAll } = require( '../Quanstructor' )

const Assigner = require('assign.js')
let assigner = new Assigner()

const STATUS_LIVE = 'Live'
const SP_PAYLOAD = 'payload'
const SP_SUPPLEMENTARY = 'supplementary'


const CONVERSION_FIXED = 'Fix'
const CONVERSION_VARIABLE = 'Variable'
const CONVERSION_DISTRIBUTION = 'Dist'
const CONVERSIONS = [ CONVERSION_FIXED, CONVERSION_VARIABLE, CONVERSION_DISTRIBUTION ]

let Clerobee = require('clerobee')
let clerobee = new Clerobee( 16 )

function newUID ( length ) {
	return clerobee.generate( length )
}


const MEASUREMENT_QUANTITY = 'Quantity'
const MEASUREMENT_AMOUNT = 'Amount'
const MEASUREMENTS = [ MEASUREMENT_QUANTITY, MEASUREMENT_AMOUNT ]

const VALIDATION_FUNC = { required: true, typeof: Function }
const VALIDATION_REQ = { required: true }
const VALIDATION_ARR = { _outer: { required: true, typeof: Array } }
const VALIDATION_OBJ = { required: true, typeof: Object }
const VALIDATION_BOOL = { required: true, typeof: Boolean }
const VALIDATION_STR = { required: true, typeof: String }
const VALIDATION_NUM = { required: true, typeof: Number }
const VALIDATION_NAME = { required: true, minlength: 2, typeof: String }
const VALIDATION_UID = { required: true, minlength: 8, typeof: 'alphanum' }



addProto( 'Entity', {
	uid: { validation: VALIDATION_UID },
	externalID: { },
	name: { validation: VALIDATION_STR },
	timestamp: { validation: VALIDATION_NUM }
} )

addProto( 'Named', {
	name: { validation: VALIDATION_STR }
} )

addProto( 'ManagedEntity', {
	template: { default: '', space: SP_PAYLOAD },

	referenceIDs: { default: {}, space: SP_SUPPLEMENTARY, validation: VALIDATION_OBJ },
	alterIDs: { default: {}, space: SP_SUPPLEMENTARY, validation: VALIDATION_OBJ },
	isolation: { default: {}, space: SP_SUPPLEMENTARY, validation: VALIDATION_OBJ },

	product: { default: {}, space: SP_SUPPLEMENTARY, validation: VALIDATION_OBJ }
} )

newQuanstructor( 'EntityState', {
	status: { validation: VALIDATION_STR },

	flowID: { default: '', validation: { required: false, typeof: String } },
	processID: { default: '', validation: { required: false, typeof: String } },
	by: { default: '', validation: { required: false, typeof: String } },
	initiatedBy: { default: '', validation: { required: false, typeof: String } },
	onBehalfOf: { default: '', validation: { required: false, typeof: String } },
	at: { validation: { required: false, typeof: Number } },

	state: { default: {}, validation: VALIDATION_OBJ },

	async _preserve (obj, projection, options = {}) {
		obj.at = Date.now()

		return obj
	}
} )

addProto( 'LiveEntity', {
	_history: { default: [], Quanstructor: 'EntityState' },
	status: { default: STATUS_LIVE, space: SP_SUPPLEMENTARY, validation: { required: false, typeof: String } }
} )

addProto( 'Flow', {
	flowID: { validation: VALIDATION_STR, space: SP_PAYLOAD },
	processID: { validation: VALIDATION_STR, space: SP_PAYLOAD },
	async _preserve (obj, projection, options = {}) {
		obj.processID = obj.processID || options.processID
		obj.flowID = obj.flowID || options.flowID

		return obj
	}
} )

addProto( 'Analytical', {
	type: { default: '' },
	subtype: { default: '' },
	method: { default: '' },
	classification: { default: {}, space: SP_SUPPLEMENTARY }
} )


addPrimus( { _preserve (obj, projection, options = {}) {
	if (!obj.uid)
		obj.uid = newUID()

	obj.timestamp = Date.now()

	return obj
} } )

let Absoluter = newQuanstructor( 'Asset', {
	amount: { validation: { required: false, typeof: Number } },
	measurement: { validation: { required: false, element: MEASUREMENTS } },
	conversionType: { validation: { required: false, element: CONVERSIONS } },
	unit: { validation: { required: false, typeof: Number } },

	base: { default: '' },
	rounding: { default: 2, validation: VALIDATION_NUM },

	isoCode: { space: SP_PAYLOAD },
	isoNumber: { space: SP_PAYLOAD },
	symbol: { space: SP_PAYLOAD }
}, 'Entity', 'ManagedEntity', 'LiveEntity', 'Analytical' )


let desc = {
	name: 'ASS-X',
	type: 'T', subtype: 'ST', method: 'M',
	amount: 1800000000,
	isoCode: 'ASS',
	isoNumber: 'ASS-1',
	measurement: 'Quantity',
	symbol: 'ASS',
	conversionType: 'Fix',
	unit: 1,
	babla: 'hhhhhhh'
}


let testWithoutValidation = false
async function test () {
	await tuneAll()

	let time = Date.now()
	for (let i = 0; i < 100000; ++i) {
		await Absoluter.derive( desc, 'complete' )
	}
	console.log( '::: ', (Date.now() - time) )

	if (!testWithoutValidation) return

	ignoreValudation(true)

	time = Date.now()
	for (let i = 0; i < 100000; ++i) {
		await Absoluter.derive( desc, 'complete' )
	}
	console.log( '::: ', (Date.now() - time) )

	time = Date.now()
	for (let i = 0; i < 100000; ++i) {
		JSON.parse( JSON.stringify( desc ) )
	}
	console.log( '::: ', (Date.now() - time) )


	time = Date.now()
	for (let i = 0; i < 100000; ++i) {
		assigner.cloneObject( desc )
	}
	console.log( '::: ', (Date.now() - time) )
}

test().then( () => {
} ).catch( console.error )
