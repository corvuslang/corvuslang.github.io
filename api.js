(function () {
  const unwrap = (result) => {
    if (result.Err) {
      throw new Error(result.Err)
    }
    return result.Ok
  }

  const js2corvus = (val) => {
    if (typeof val === 'number') {
      return {
        Prim: {
          Number: val
        }
      }
    }
    if (typeof val === 'string') {
      return {
        Prim: {
          String: val
        }
      }
    }
    if (typeof val === 'boolean') {
      return {
        Prim: {
          Boolean: val
        }
      }
    }
    if (val instanceof Date) {
      return {
        Prim: {
          Time: val.getTime()
        }
      }
    }
    if (Array.isArray(val)) {
      return {
        List: val.map(v => js2corvus(v))
      }
    }
    if (typeof val === 'object') {
      return {
        Record: mapValues(val, js2corvus)
      }
    }
  }

  const corvus2js = (val) => {
    if (val.Prim) {
      for (const k in val.Prim) {
        if (val.Prim.hasOwnProperty(k)) {
          return val.Prim[k]
        }
      }
    }
    if (val.Record) {
      return mapValues(val.Record, corvus2js)
    }
    if (val.List) {
      return val.List.map(corvus2js)
    }
    return val
  }

  const mapValues = (obj, fn) => {
    const out = {}
    for (var k in obj) {
      out[k] = fn(obj[k])
    }
    return out
  }

  const createCorvus = (wasmExports) => {
    const handle = wasmExports.alloc_bird();
    return mapValues({
      eval: (string, inputs) => corvus2js(unwrap(wasmExports.evaluate(handle, string, mapValues(inputs, js2corvus)))),
      typeOf: (string) => unwrap(wasmExports.type_of(handle, string)),
      set: (name, val) => wasmExports.set_var(handle, name, js2corvus(val)),
      vars: () => mapValues(wasmExports.get_var(handle), corvus2js),
      destroy: () => {
        wasmExports.drop_bird(handle);
        handle = null
      },
    }, (fn) => (...args) => {
      if (handle) {
        return fn(...args)
      }
      throw new Error('Bird has been destroyed')
    })
  }

  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    const wasmExports = require('../target/wasm32-unknown-unknown/release/corvus_js.js');
    console.log(Object.keys(wasmExports))
    module.exports = () => createCorvus(wasmExports)
  } else if (typeof Rust !== 'undefined' && typeof window !== 'undefined') {
    window.createCorvus = () => Rust.corvus_js.then(createCorvus)
  } else {
    throw new Error('Unsupported environment')
  }
})()