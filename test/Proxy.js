const Numberify = require( '../lib/Proxyfier' )
let p = Numberify( {}, Number(10) )

console.log(p.c, Object.getPrototypeOf(p), p instanceof Number, p.prototype, p.toString(), p.valueOf(), '---', 5 + p)
