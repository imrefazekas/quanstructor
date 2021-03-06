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
				passportID: { default: () => { return Date.now() + '?' }, spaces: [ 'database', 'secret' ], validation: REQUIRED },
				address: { space: SPACE_SUPP, default: { street: '', county: '', country: '', postal: '' }, validation: {
					street: REQUIRED, county: REQUIRED, country: REQUIRED, postal: REQUIRED
				} },
				phone: { space: SPACE_SUPP, required: true, typeof: 'phone' },
				phoneShort: { space: SPACE_SUPP, Proxy: (obj) => { return obj.phone.substring( 0, 2 ) }, _persistent: true },
				email: { space: SPACE_SUPP, required: true, typeof: 'email' }
			}, 'Entity', 'Referenced' )
			Absoluter.keepQType( true )

			console.log(':::', Absoluter)

			console.log( await Absoluter.proto() )
			// console.log( await Absoluter.derive( PERSON_PROTO_PLAIN ) )

			Absoluter.project( 'secret', [ Quastructor.QUALITY_SPACE, 'secret' ] )
			Absoluter.project( 'database', [ Quastructor.QUALITY_SPACE, 'database' ] )
			console.log('-----' )
			console.log( await Absoluter.build( PERSON_PROTO_DB, 'database' ) )
			console.log( (await Absoluter.build( PERSON_PROTO_DB, 'database' )).phoneShort )
			console.log('****-----' )
			console.log( await Absoluter.derive( PERSON_PROTO_DB, 'database', 'secret' ) )
		} )

		it('Embed Data', async function () {
			let Absoluter = Quastructor.newQuanstructor( 'Employee', {
				employeeID: { validation: REQUIRED },
				person: { space: SPACE_SUPP, Quanstructor: 'Person' },
				people: { default: [], space: SPACE_SUPP, Quanstructor: 'Person' }
			} )
			console.log( 'SCHEMA::::::', await Absoluter.schema( 'Emp' ) )

			console.log( JSON.stringify( await Absoluter.build( {
				employeeID: '121212',
				person: PERSON_PROTO_DB,
				people: [ PERSON_PROTO_DB ]
			} ), null, 4 ) )

			console.log( '***', JSON.stringify( await Absoluter.derive( {
				employeeID: '121212',
				person: PERSON_PROTO_DB,
				people: [ PERSON_PROTO_DB ]
			} ), null, 4 ) )
		} )

		it('Crossroads', async function () {
			let RoadAbsoluter = Quastructor.newQuanstructor( 'Road', {
				distance: { validation: { required: true, typeof: Number } }
			} )
			let HighwayAbsoluter = Quastructor.newQuanstructor( 'Highway', {
				lanes: { validation: { required: true, typeof: Number } }
			} )
			let PathAbsoluter = Quastructor.newQuanstructor( 'Path', {
				ways: { default: [], Quanstructor: 'Road, Highway' }
			} )
			console.log( JSON.stringify( await PathAbsoluter.build( {
				ways: [ { distance: 2 }, { lanes: 5, _qtype: 'Highway' } ]
			} ), null, 4 ) )
			console.log( JSON.stringify( await PathAbsoluter.derive( {
				ways: [ { distance: 2 }, { lanes: 5, _qtype: 'Highway' } ]
			} ), null, 4 ) )
		} )
	} )

	after( async function () {
		console.log('done')
	} )

} )
