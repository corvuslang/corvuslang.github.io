"use strict";

if( typeof Rust === "undefined" ) {
    var Rust = {};
}

(function( root, factory ) {
    if( typeof define === "function" && define.amd ) {
        define( [], factory );
    } else if( typeof module === "object" && module.exports ) {
        module.exports = factory();
    } else {
        Rust.corvus_js = factory();
    }
}( this, function() {
    function __initialize( __wasm_module, __load_asynchronously ) {
    const Module = {};

    Module.STDWEB_PRIVATE = {};

// This is based on code from Emscripten's preamble.js.
Module.STDWEB_PRIVATE.to_utf8 = function to_utf8( str, addr ) {
    for( var i = 0; i < str.length; ++i ) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt( i ); // possibly a lead surrogate
        if( u >= 0xD800 && u <= 0xDFFF ) {
            u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt( ++i ) & 0x3FF);
        }

        if( u <= 0x7F ) {
            HEAPU8[ addr++ ] = u;
        } else if( u <= 0x7FF ) {
            HEAPU8[ addr++ ] = 0xC0 | (u >> 6);
            HEAPU8[ addr++ ] = 0x80 | (u & 63);
        } else if( u <= 0xFFFF ) {
            HEAPU8[ addr++ ] = 0xE0 | (u >> 12);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 6) & 63);
            HEAPU8[ addr++ ] = 0x80 | (u & 63);
        } else if( u <= 0x1FFFFF ) {
            HEAPU8[ addr++ ] = 0xF0 | (u >> 18);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 12) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 6) & 63);
            HEAPU8[ addr++ ] = 0x80 | (u & 63);
        } else if( u <= 0x3FFFFFF ) {
            HEAPU8[ addr++ ] = 0xF8 | (u >> 24);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 18) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 12) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 6) & 63);
            HEAPU8[ addr++ ] = 0x80 | (u & 63);
        } else {
            HEAPU8[ addr++ ] = 0xFC | (u >> 30);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 24) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 18) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 12) & 63);
            HEAPU8[ addr++ ] = 0x80 | ((u >> 6) & 63);
            HEAPU8[ addr++ ] = 0x80 | (u & 63);
        }
    }
};

Module.STDWEB_PRIVATE.noop = function() {};
Module.STDWEB_PRIVATE.to_js = function to_js( address ) {
    var kind = HEAPU8[ address + 12 ];
    if( kind === 0 ) {
        return undefined;
    } else if( kind === 1 ) {
        return null;
    } else if( kind === 2 ) {
        return HEAP32[ address / 4 ];
    } else if( kind === 3 ) {
        return HEAPF64[ address / 8 ];
    } else if( kind === 4 ) {
        var pointer = HEAPU32[ address / 4 ];
        var length = HEAPU32[ (address + 4) / 4 ];
        return Module.STDWEB_PRIVATE.to_js_string( pointer, length );
    } else if( kind === 5 ) {
        return false;
    } else if( kind === 6 ) {
        return true;
    } else if( kind === 7 ) {
        var pointer = HEAPU32[ address / 4 ];
        var length = HEAPU32[ (address + 4) / 4 ];
        var output = [];
        for( var i = 0; i < length; ++i ) {
            output.push( Module.STDWEB_PRIVATE.to_js( pointer + i * 16 ) );
        }
        return output;
    } else if( kind === 8 ) {
        var value_array_pointer = HEAPU32[ address / 4 ];
        var length = HEAPU32[ (address + 4) / 4 ];
        var key_array_pointer = HEAPU32[ (address + 8) / 4 ];
        var output = {};
        for( var i = 0; i < length; ++i ) {
            var key_pointer = HEAPU32[ (key_array_pointer + i * 8) / 4 ];
            var key_length = HEAPU32[ (key_array_pointer + 4 + i * 8) / 4 ];
            var key = Module.STDWEB_PRIVATE.to_js_string( key_pointer, key_length );
            var value = Module.STDWEB_PRIVATE.to_js( value_array_pointer + i * 16 );
            output[ key ] = value;
        }
        return output;
    } else if( kind === 9 ) {
        return Module.STDWEB_PRIVATE.acquire_js_reference( HEAP32[ address / 4 ] );
    } else if( kind === 10 ) {
        var adapter_pointer = HEAPU32[ address / 4 ];
        var pointer = HEAPU32[ (address + 4) / 4 ];
        var deallocator_pointer = HEAPU32[ (address + 8) / 4 ];
        var output = function() {
            if( pointer === 0 ) {
                throw new ReferenceError( "Already dropped Rust function called!" );
            }

            var args = Module.STDWEB_PRIVATE.alloc( 16 );
            Module.STDWEB_PRIVATE.serialize_array( args, arguments );
            Module.STDWEB_PRIVATE.dyncall( "vii", adapter_pointer, [pointer, args] );
            var result = Module.STDWEB_PRIVATE.tmp;
            Module.STDWEB_PRIVATE.tmp = null;

            return result;
        };

        output.drop = function() {
            output.drop = Module.STDWEB_PRIVATE.noop;
            var function_pointer = pointer;
            pointer = 0;

            Module.STDWEB_PRIVATE.dyncall( "vi", deallocator_pointer, [function_pointer] );
        };

        return output;
    } else if( kind === 13 ) {
        var adapter_pointer = HEAPU32[ address / 4 ];
        var pointer = HEAPU32[ (address + 4) / 4 ];
        var deallocator_pointer = HEAPU32[ (address + 8) / 4 ];
        var output = function() {
            if( pointer === 0 ) {
                throw new ReferenceError( "Already called or dropped FnOnce function called!" );
            }

            output.drop = Module.STDWEB_PRIVATE.noop;
            var function_pointer = pointer;
            pointer = 0;

            var args = Module.STDWEB_PRIVATE.alloc( 16 );
            Module.STDWEB_PRIVATE.serialize_array( args, arguments );
            Module.STDWEB_PRIVATE.dyncall( "vii", adapter_pointer, [function_pointer, args] );
            var result = Module.STDWEB_PRIVATE.tmp;
            Module.STDWEB_PRIVATE.tmp = null;

            return result;
        };

        output.drop = function() {
            output.drop = Module.STDWEB_PRIVATE.noop;
            var function_pointer = pointer;
            pointer = 0;

            Module.STDWEB_PRIVATE.dyncall( "vi", deallocator_pointer, [function_pointer] );
        };

        return output;
    } else if( kind === 14 ) {
        var pointer = HEAPU32[ address / 4 ];
        var length = HEAPU32[ (address + 4) / 4 ];
        var array_kind = HEAPU32[ (address + 8) / 4 ];
        var pointer_end = pointer + length;

        switch( array_kind ) {
            case 0:
                return HEAPU8.subarray( pointer, pointer_end );
            case 1:
                return HEAP8.subarray( pointer, pointer_end );
            case 2:
                return HEAPU16.subarray( pointer, pointer_end );
            case 3:
                return HEAP16.subarray( pointer, pointer_end );
            case 4:
                return HEAPU32.subarray( pointer, pointer_end );
            case 5:
                return HEAP32.subarray( pointer, pointer_end );
            case 6:
                return HEAPF32.subarray( pointer, pointer_end );
            case 7:
                return HEAPF64.subarray( pointer, pointer_end );
        }
    } else if( kind === 15 ) {
        return Module.STDWEB_PRIVATE.get_raw_value( HEAPU32[ address / 4 ] );
    }
};

Module.STDWEB_PRIVATE.serialize_object = function serialize_object( address, value ) {
    var keys = Object.keys( value );
    var length = keys.length;
    var key_array_pointer = Module.STDWEB_PRIVATE.alloc( length * 8 );
    var value_array_pointer = Module.STDWEB_PRIVATE.alloc( length * 16 );
    HEAPU8[ address + 12 ] = 8;
    HEAPU32[ address / 4 ] = value_array_pointer;
    HEAPU32[ (address + 4) / 4 ] = length;
    HEAPU32[ (address + 8) / 4 ] = key_array_pointer;
    for( var i = 0; i < length; ++i ) {
        var key = keys[ i ];
        var key_length = Module.STDWEB_PRIVATE.utf8_len( key );
        var key_pointer = Module.STDWEB_PRIVATE.alloc( key_length );
        Module.STDWEB_PRIVATE.to_utf8( key, key_pointer );

        var key_address = key_array_pointer + i * 8;
        HEAPU32[ key_address / 4 ] = key_pointer;
        HEAPU32[ (key_address + 4) / 4 ] = key_length;

        Module.STDWEB_PRIVATE.from_js( value_array_pointer + i * 16, value[ key ] );
    }
};

Module.STDWEB_PRIVATE.serialize_array = function serialize_array( address, value ) {
    var length = value.length;
    var pointer = Module.STDWEB_PRIVATE.alloc( length * 16 );
    HEAPU8[ address + 12 ] = 7;
    HEAPU32[ address / 4 ] = pointer;
    HEAPU32[ (address + 4) / 4 ] = length;
    for( var i = 0; i < length; ++i ) {
        Module.STDWEB_PRIVATE.from_js( pointer + i * 16, value[ i ] );
    }
};

Module.STDWEB_PRIVATE.from_js = function from_js( address, value ) {
    var kind = Object.prototype.toString.call( value );
    if( kind === "[object String]" ) {
        var length = Module.STDWEB_PRIVATE.utf8_len( value );
        var pointer = 0;
        if( length > 0 ) {
            pointer = Module.STDWEB_PRIVATE.alloc( length );
            Module.STDWEB_PRIVATE.to_utf8( value, pointer );
        }
        HEAPU8[ address + 12 ] = 4;
        HEAPU32[ address / 4 ] = pointer;
        HEAPU32[ (address + 4) / 4 ] = length;
    } else if( kind === "[object Number]" ) {
        if( value === (value|0) ) {
            HEAPU8[ address + 12 ] = 2;
            HEAP32[ address / 4 ] = value;
        } else {
            HEAPU8[ address + 12 ] = 3;
            HEAPF64[ address / 8 ] = value;
        }
    } else if( value === null ) {
        HEAPU8[ address + 12 ] = 1;
    } else if( value === undefined ) {
        HEAPU8[ address + 12 ] = 0;
    } else if( value === false ) {
        HEAPU8[ address + 12 ] = 5;
    } else if( value === true ) {
        HEAPU8[ address + 12 ] = 6;
    } else if( kind === "[object Symbol]" ) {
        var id = Module.STDWEB_PRIVATE.register_raw_value( value );
        HEAPU8[ address + 12 ] = 15;
        HEAP32[ address / 4 ] = id;
    } else {
        var refid = Module.STDWEB_PRIVATE.acquire_rust_reference( value );
        HEAPU8[ address + 12 ] = 9;
        HEAP32[ address / 4 ] = refid;
    }
};

// This is ported from Rust's stdlib; it's faster than
// the string conversion from Emscripten.
Module.STDWEB_PRIVATE.to_js_string = function to_js_string( index, length ) {
    index = index|0;
    length = length|0;
    var end = (index|0) + (length|0);
    var output = "";
    while( index < end ) {
        var x = HEAPU8[ index++ ];
        if( x < 128 ) {
            output += String.fromCharCode( x );
            continue;
        }
        var init = (x & (0x7F >> 2));
        var y = 0;
        if( index < end ) {
            y = HEAPU8[ index++ ];
        }
        var ch = (init << 6) | (y & 63);
        if( x >= 0xE0 ) {
            var z = 0;
            if( index < end ) {
                z = HEAPU8[ index++ ];
            }
            var y_z = ((y & 63) << 6) | (z & 63);
            ch = init << 12 | y_z;
            if( x >= 0xF0 ) {
                var w = 0;
                if( index < end ) {
                    w = HEAPU8[ index++ ];
                }
                ch = (init & 7) << 18 | ((y_z << 6) | (w & 63));

                output += String.fromCharCode( 0xD7C0 + (ch >> 10) );
                ch = 0xDC00 + (ch & 0x3FF);
            }
        }
        output += String.fromCharCode( ch );
        continue;
    }
    return output;
};

Module.STDWEB_PRIVATE.id_to_ref_map = {};
Module.STDWEB_PRIVATE.id_to_refcount_map = {};
Module.STDWEB_PRIVATE.ref_to_id_map = new WeakMap();
Module.STDWEB_PRIVATE.last_refid = 1;

Module.STDWEB_PRIVATE.id_to_raw_value_map = {};
Module.STDWEB_PRIVATE.last_raw_value_id = 1;

Module.STDWEB_PRIVATE.acquire_rust_reference = function( reference ) {
    if( reference === undefined || reference === null ) {
        return 0;
    }

    var id_to_refcount_map = Module.STDWEB_PRIVATE.id_to_refcount_map;
    var id_to_ref_map = Module.STDWEB_PRIVATE.id_to_ref_map;
    var ref_to_id_map = Module.STDWEB_PRIVATE.ref_to_id_map;

    var refid = ref_to_id_map.get( reference );
    if( refid === undefined ) {
        refid = Module.STDWEB_PRIVATE.last_refid++;
        ref_to_id_map.set( reference, refid );
    }

    if( refid in id_to_ref_map ) {
        id_to_refcount_map[ refid ]++;
    } else {
        id_to_ref_map[ refid ] = reference;
        id_to_refcount_map[ refid ] = 1;
    }

    return refid;
};

Module.STDWEB_PRIVATE.acquire_js_reference = function( refid ) {
    return Module.STDWEB_PRIVATE.id_to_ref_map[ refid ];
};

Module.STDWEB_PRIVATE.increment_refcount = function( refid ) {
    Module.STDWEB_PRIVATE.id_to_refcount_map[ refid ]++;
};

Module.STDWEB_PRIVATE.decrement_refcount = function( refid ) {
    var id_to_refcount_map = Module.STDWEB_PRIVATE.id_to_refcount_map;
    var id_to_ref_map = Module.STDWEB_PRIVATE.id_to_ref_map;
    id_to_refcount_map[ refid ]--;
    if( id_to_refcount_map[ refid ] === 0 ) {
        var reference = id_to_ref_map[ refid ];
        delete id_to_ref_map[ refid ];
        delete id_to_refcount_map[ refid ];
    }
};

Module.STDWEB_PRIVATE.register_raw_value = function( value ) {
    var id = Module.STDWEB_PRIVATE.last_raw_value_id++;
    Module.STDWEB_PRIVATE.id_to_raw_value_map[ id ] = value;
    return id;
};

Module.STDWEB_PRIVATE.unregister_raw_value = function( id ) {
    delete Module.STDWEB_PRIVATE.id_to_raw_value_map[ id ];
};

Module.STDWEB_PRIVATE.get_raw_value = function( id ) {
    return Module.STDWEB_PRIVATE.id_to_raw_value_map[ id ];
};

Module.STDWEB_PRIVATE.alloc = function alloc( size ) {
    return Module.web_malloc( size );
};

Module.STDWEB_PRIVATE.dyncall = function( signature, ptr, args ) {
    return Module.web_table.get( ptr ).apply( null, args );
};

// This is based on code from Emscripten's preamble.js.
Module.STDWEB_PRIVATE.utf8_len = function utf8_len( str ) {
    let len = 0;
    for( let i = 0; i < str.length; ++i ) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        let u = str.charCodeAt( i ); // possibly a lead surrogate
        if( u >= 0xD800 && u <= 0xDFFF ) {
            u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt( ++i ) & 0x3FF);
        }

        if( u <= 0x7F ) {
            ++len;
        } else if( u <= 0x7FF ) {
            len += 2;
        } else if( u <= 0xFFFF ) {
            len += 3;
        } else if( u <= 0x1FFFFF ) {
            len += 4;
        } else if( u <= 0x3FFFFFF ) {
            len += 5;
        } else {
            len += 6;
        }
    }
    return len;
};

Module.STDWEB_PRIVATE.prepare_any_arg = function( value ) {
    var arg = Module.STDWEB_PRIVATE.alloc( 16 );
    Module.STDWEB_PRIVATE.from_js( arg, value );
    return arg;
};

Module.STDWEB_PRIVATE.acquire_tmp = function( dummy ) {
    var value = Module.STDWEB_PRIVATE.tmp;
    Module.STDWEB_PRIVATE.tmp = null;
    return value;
};



    let HEAP8 = null;
    let HEAP16 = null;
    let HEAP32 = null;
    let HEAPU8 = null;
    let HEAPU16 = null;
    let HEAPU32 = null;
    let HEAPF32 = null;
    let HEAPF64 = null;

    Object.defineProperty( Module, 'exports', { value: {} } );

    const __imports = {
        env: {
            "__extjs_9f22d4ca7bc938409787341b7db181f8dd41e6df": function($0) {
                Module.STDWEB_PRIVATE.increment_refcount( $0 );
            },
            "__extjs_fe1e80bdcfe7f7cb820b64a40f6d286cbd345955": function($0) {
                return (Module.STDWEB_PRIVATE.acquire_js_reference( $0 ) instanceof Array) | 0;
            },
            "__extjs_ec5f17b629db0b37cef1b6141e3dfad07ed044ca": function($0, $1) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);Module.STDWEB_PRIVATE.from_js($0, (function(){return new Date (($1));})());
            },
            "__extjs_72fc447820458c720c68d0d8e078ede631edd723": function($0, $1, $2) {
                console.error( 'Panic location:', Module.STDWEB_PRIVATE.to_js_string( $0, $1 ) + ':' + $2 );
            },
            "__extjs_80d6d56760c65e49b7be8b6b01c1ea861b046bf0": function($0) {
                Module.STDWEB_PRIVATE.decrement_refcount( $0 );
            },
            "__extjs_ff5103e6cc179d13b4c7a785bdce2708fd559fc0": function($0) {
                Module.STDWEB_PRIVATE.tmp = Module.STDWEB_PRIVATE.to_js( $0 );
            },
            "__extjs_6ae2f0d3420b3969fbdee9a1a7eba4cef664b99f": function($0) {
                return (Module.STDWEB_PRIVATE.acquire_js_reference( $0 ) instanceof Object) | 0;
            },
            "__extjs_93b9872dc3d816765ab0e68585457a4b8d33560b": function($0) {
                $0 = Module.STDWEB_PRIVATE.to_js($0);Promise.resolve (). then (function (){($0)();});
            },
            "__extjs_0aced9e2351ced72f1ff99645a129132b16c0d3c": function($0) {
                var value = Module.STDWEB_PRIVATE.get_raw_value( $0 );return Module.STDWEB_PRIVATE.register_raw_value( value );
            },
            "__extjs_ee41f864457c794c278cdcafc28967ffbac29706": function($0, $1) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);Module.STDWEB_PRIVATE.from_js($0, (function(){return ($1);})());
            },
            "__extjs_f814fda503cb20016f78481f85431d48a7c4e731": function($0, $1) {
                var object = Module.STDWEB_PRIVATE.acquire_js_reference( $0 );Module.STDWEB_PRIVATE.serialize_object( $1, object );
            },
            "__extjs_6a3fd7b87c15100189ec55507aab3d0e6002afdf": function($0, $1) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);Module.STDWEB_PRIVATE.from_js($0, (function(){return ($1). next ()})());
            },
            "__extjs_da7526dacc33bb6de7714dde287806f568820e31": function($0) {
                $0 = Module.STDWEB_PRIVATE.to_js($0);console.log (($0));
            },
            "__extjs_97495987af1720d8a9a923fa4683a7b683e3acd6": function($0, $1) {
                console.error( 'Panic error message:', Module.STDWEB_PRIVATE.to_js_string( $0, $1 ) );
            },
            "__extjs_c6b1bf73c8dd14844e633ddec557fd8e13c9359b": function($0, $1, $2) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);$2 = Module.STDWEB_PRIVATE.to_js($2);Module.STDWEB_PRIVATE.from_js($0, (function(){return ($1)[($2)]})());
            },
            "__extjs_79e0f16ebeb2ff1733d3e1516622f2a6c27fc7fa": function($0, $1) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);Module.STDWEB_PRIVATE.from_js($0, (function(){return ($1)[Symbol.iterator]()})());
            },
            "__extjs_8c32019649bb581b1b742eeedfc410e2bedd56a6": function($0, $1) {
                var array = Module.STDWEB_PRIVATE.acquire_js_reference( $0 );Module.STDWEB_PRIVATE.serialize_array( $1, array );
            },
            "__extjs_dc2fd915bd92f9e9c6a3bd15174f1414eee3dbaf": function() {
                console.error( 'Encountered a panic!' );
            },
            "__extjs_80a88fca18b223bc431783405919f8321ee277a9": function($0) {
                return (Module.STDWEB_PRIVATE.acquire_js_reference( $0 ) instanceof Date) | 0;
            },
            "__extjs_db0226ae1bbecd407e9880ee28ddc70fc3322d9c": function($0) {
                $0 = Module.STDWEB_PRIVATE.to_js($0);Module.STDWEB_PRIVATE.unregister_raw_value (($0));
            },
            "__extjs_3f12bfb802f39165bc73bb514366faaba98d3e6c": function($0, $1, $2) {
                $1 = Module.STDWEB_PRIVATE.to_js($1);$2 = Module.STDWEB_PRIVATE.to_js($2);Module.STDWEB_PRIVATE.from_js($0, (function(){var cb = ($1); return cb (($2))})());
            },
            "__web_on_grow": function() {
                const buffer = Module.instance.exports.memory.buffer;
                HEAP8 = new Int8Array( buffer );
                HEAP16 = new Int16Array( buffer );
                HEAP32 = new Int32Array( buffer );
                HEAPU8 = new Uint8Array( buffer );
                HEAPU16 = new Uint16Array( buffer );
                HEAPU32 = new Uint32Array( buffer );
                HEAPF32 = new Float32Array( buffer );
                HEAPF64 = new Float64Array( buffer );
            }
        }
    };

    function __instantiate( instance ) {
        Object.defineProperty( Module, 'instance', { value: instance } );
        Object.defineProperty( Module, 'web_malloc', { value: Module.instance.exports.__web_malloc } );
        Object.defineProperty( Module, 'web_free', { value: Module.instance.exports.__web_free } );
        Object.defineProperty( Module, 'web_table', { value: Module.instance.exports.__web_table } );

        Module.exports.alloc_ns = function alloc_ns() {
    return Module.instance.exports.alloc_ns();
}
;
                Module.exports.drop_ns = function drop_ns(ns_ptr) {
    Module.instance.exports.drop_ns(ns_ptr);
}
;
                Module.exports.print_sig = function print_sig(signature) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.print_sig(Module.STDWEB_PRIVATE.prepare_any_arg(signature)));
}
;
                Module.exports.define = function define(ns_ptr, signature, callback) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.define(ns_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(signature), Module.STDWEB_PRIVATE.prepare_any_arg(callback)));
}
;
                Module.exports.function_ids = function function_ids(ns_ptr) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.function_ids(ns_ptr));
}
;
                Module.exports.get_signature = function get_signature(ns_ptr, id) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.get_signature(ns_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(id)));
}
;
                Module.exports.intern_symbol = function intern_symbol(ns_ptr, symbol) {
    return Module.instance.exports.intern_symbol(ns_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(symbol));
}
;
                Module.exports.lookup_symbol = function lookup_symbol(ns_ptr, symbol) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.lookup_symbol(ns_ptr, symbol));
}
;
                Module.exports.compile = function compile(ns_ptr, input) {
    return Module.instance.exports.compile(ns_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(input));
}
;
                Module.exports.drop_script = function drop_script(handle) {
    Module.instance.exports.drop_script(handle);
}
;
                Module.exports.recompile = function recompile(script_ptr, code) {
    Module.instance.exports.recompile(script_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(code));
}
;
                Module.exports.type_info = function type_info(script_ptr) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.type_info(script_ptr));
}
;
                Module.exports.print_value = function print_value(value) {
    Module.instance.exports.print_value(Module.STDWEB_PRIVATE.prepare_any_arg(value));
}
;
                Module.exports.evaluate = function evaluate(script_ptr, inputs) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.evaluate(script_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(inputs)));
}
;
                Module.exports.call_block = function call_block(block_ptr, args) {
    return Module.STDWEB_PRIVATE.acquire_tmp(Module.instance.exports.call_block(block_ptr, Module.STDWEB_PRIVATE.prepare_any_arg(args)));
}
;
                Module.exports.drop_block = function drop_block(block_ptr) {
    Module.instance.exports.drop_block(block_ptr);
}
;
        __imports.env.__web_on_grow();
        
    }

    if( __load_asynchronously ) {
        return WebAssembly.instantiate( __wasm_module, __imports )
            .then( instance => {
                __instantiate( instance );
                console.log( "Finished loading Rust wasm module 'corvus_js'" );
                return Module.exports;
            })
            .catch( error => {
                console.log( "Error loading Rust wasm module 'corvus_js':", error );
                throw error;
            });
    } else {
        const instance = new WebAssembly.Instance( __wasm_module, __imports );
        __instantiate( instance );
        return Module.exports;
    }
}


    if( typeof window === "undefined" && typeof process === "object" ) {
        const fs = require( "fs" );
        const path = require( "path" );
        const wasm_path = path.join( __dirname, "corvus_js.wasm" );
        const buffer = fs.readFileSync( wasm_path );
        const mod = new WebAssembly.Module( buffer );

        return __initialize( mod, false );
    } else {
        return fetch( "corvus_js.wasm" )
            .then( response => response.arrayBuffer() )
            .then( bytes => WebAssembly.compile( bytes ) )
            .then( mod => __initialize( mod, true ) );
    }
}));
