const Quastructor = require( '../Quanstructor' )

let REQUIRED = { required: true, typeof: String, minlength: 2 }

let SPACE_SUPP = 'supplementary'

let PERSON_PROTO_PLAIN = {
	uid: 'U12', name: 'Peter', externalID: 'E32',
	passportID: 'AS1223432',
	address: { street: 'Cool str 1', county: 'Wowland', country: 'FUHCLA', postal: '1111P' },
	phone: '+12121212', email: 'peter@pet.co'
}

let PERSON_PROTO_DB = {
	uid: 'U12', name: 'Peter', externalID: 'E32',
	database: {	passportID: 'AS1223432' },
	address: { street: 'Cool str 1', county: 'Wowland', country: 'FUHCLA', postal: '1111P' },
	phone: '+12121212', email: 'peter@pet.co'
}

describe('Quastructor', function () {

	before( async function () {
		Quastructor.addProto( 'Entity', {
			uid: { validation: REQUIRED },
			name: { validation: REQUIRED }
		} )

		Quastructor.addProto( 'Referenced', {
			externalID: { validation: REQUIRED },
			alterIDs: { space: SPACE_SUPP, validation: { required: true, typeof: Array } }
		} )
	} )

	describe('New Proto', function () {
		it('Define Data', async function () {
			let Absoluter = Quastructor.newQuanstructor( 'Person', {
				passportID: { spaces: [ 'database', 'secret' ], validation: REQUIRED },
				address: { space: SPACE_SUPP, default: { street: '', county: '', country: '', postal: '' }, validation: {
					street: REQUIRED, county: REQUIRED, country: REQUIRED, postal: REQUIRED
				} },
				phone: { space: SPACE_SUPP, required: true, typeof: 'phone' },
				email: { space: SPACE_SUPP, required: true, typeof: 'email' }
			}, 'Entity', 'Referenced' )

			console.log(':::', Absoluter)

			console.log( await Absoluter.proto() )
			// console.log( await Absoluter.derive( PERSON_PROTO_PLAIN ) )

			Absoluter.project( 'secret', [ Quastructor.QUALITY_SPACE, 'secret' ] )
			Absoluter.project( 'database', [ Quastructor.QUALITY_SPACE, 'database' ] )
			console.log('-----' )
			console.log( await Absoluter.build( PERSON_PROTO_DB, 'database' ) )
			console.log( await Absoluter.derive( PERSON_PROTO_DB, 'database', 'secret' ) )
		} )

		it('Embed Data', async function () {
			let Absoluter = Quastructor.newQuanstructor( 'Employee', {
				employeeID: { validation: REQUIRED },
				person: { space: SPACE_SUPP, Quanstructor: 'Person' },
				people: { default: [], space: SPACE_SUPP, Quanstructor: 'Person' }
			} )
			console.log( await Absoluter.build( {
				employeeID: '121212',
				person: PERSON_PROTO_DB,
				people: [ PERSON_PROTO_DB ]
			} ) )
		} )
	} )

	after( async function () {
		console.log('done')
	} )

} )
