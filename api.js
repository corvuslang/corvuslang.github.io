(function () {
  const unwrap = (result) => {
    if (result.Err) {
      throw new Error(result.Err)
    }
    return result.Ok
  }

  const js2corvus = (val) => {
    return [js2corvus_(val), null]
  }

  const js2corvus_ = (val) => {
    if (val == null) {
      throw new TypeError('Passing undefined or null into Corvus')
    }
    if (typeof val !== 'object' || val instanceof Date) {
      return val
    }
    if (Array.isArray(val)) {
      return val.map(js2corvus_)
    }
    return mapValues(val, js2corvus_)
  }

  const mapValues = (obj, fn) => {
    const out = {}
    for (var k in obj) {
      out[k] = fn(obj[k])
    }
    return out
  }

  class TypeRegistry {
    constructor() {
      this._aliases = new Map()
    }

    define(name, type) {
      if (this._aliases.has(name)) {
        throw new Error(`Type ${name} is already defined`)
      }
      this._aliases.set(name, this.resolve(type))
    }

    listOf(type) {
      return {
        List: this.resolve(type)
      }
    }

    variable(name) {
      return {
        Var: name
      }
    }

    block(inputs, output) {
      inputs = Array.isArray(inputs) ? inputs : [inputs]
      return {
        Block: [inputs.map(x => this.resolve(x)), this.resolve(output)]
      }
    }

    resolve(type) {
      if (typeof type === 'string') {
        return this._resolveByName(type)
      }
      if (typeof type === 'object') {
        return {
          Record: [true, mapValues(type, field => {
            if (field.hasOwnProperty('optional')) {
              return {
                optional: Boolean(field.optional),
                ty: this.resolve(field.ty)
              }
            }
            if (field.hasOwnProperty('required')) {
              return {
                optional: !field.required,
                ty: this.resolve(field.ty)
              }
            }
            return {
              optional: false,
              ty: this.resolve(field)
            }
          })]
        }
      }
    }

    _resolveByName(type) {
      switch (type) {
        case 'string':
          return 'Str'
        case 'boolean':
          return 'Bool'
        case 'number':
          return 'Num'
        case 'time':
        case 'date':
          return 'Time'
      }
      if (type in this._aliases) {
        return this._aliases[type]
      }
    }
  }

  class FunctionBuilder {
    constructor(types) {
      this[priv] = {

      }
      this._types = types
      this._args = []
      this._returnType = null
      this._callback = null
    }

    requireArg(name, type) {
      this._args.push({
        name: name,
        ty: this._types.resolve(type),
        required: true,
        variadic: false,
      })
    }

    allowArg(name, type) {
      this._args.push({
        name: name,
        ty: this._types.resolve(type),
        required: false,
        variadic: false,
      })
    }

    allowArgRepeated(name, type) {
      this._args.push({
        name: name,
        ty: this._types.resolve(type),
        required: false,
        variadic: true,
      })
    }

    requireArgRepeated(name, type) {
      this._args.push({
        name: name,
        ty: this._types.resolve(type),
        required: true,
        variadic: true,
      })
    }

    canFail() {
      this._total = false
    }

    neverFails() {
      this._total = true
    }

    returns(type) {
      this._returnType = this._types.resolve(type)
    }

    handler(callback) {
      this._callback = callback
    }

    _validated() {
      if (!this._args.length) {
        throw new TypeError('Functions must take at least one argument')
      }
      const name = this._args[0].name
      if (!this._returnType) {
        throw new TypeError(`Missing return type for function ${name}`)
      }
      if (!this._callback) {
        throw new TypeError(`Missing callback for function ${name}`)
      }
      const signature = {
        total: Boolean(this._total),
        args: this._args,
        return_type: this._returnType,
      }
      return [signature, this._callback]
    }
  }

  const ArgMissing = Symbol("ArgMissing");

  const drop = Symbol("drop")
  const priv = Symbol("private")

  class Namespace {
    constructor(wasmExports) {
      const pointer = wasmExports.alloc_ns();
      this.types = new TypeRegistry()
      this[priv] = {
        wasmExports,
        pointer,
        allocatedScripts: new Set(),
      }
    }

    define(build) {
      const {
        wasmExports,
        pointer,
      } = this[priv];
      const builder = new FunctionBuilder(this.types);
      build(builder);
      const [signature, callback] = builder._validated();
      const symbolMap = new Map()
      signature.args.forEach(arg => {
        let symbolText = arg.name
        let symbolId = wasmExports.intern_symbol(pointer, symbolText)
        symbolMap.set(symbolText, symbolId)
        arg.name = symbolId
      })
      wasmExports.define(pointer, signature, (rawArgs) => {
        const args = new Args(wasmExports, symbolMap, rawArgs)
        try {
          return {
            Ok: js2corvus(callback(args))
          }
        } catch (error) {
          return {
            Err: error.toString()
          }
        } finally {
          args[drop]()
        }
      });
    }

    defineType(name, type) {
      this.types.define(name, type)
    }

    getSignature(name) {
      const {
        wasmExports,
        pointer
      } = this[priv];
      const sig = wasmExports.get_signature(pointer, name)
      if (!sig) {
        return null
      }
      sig.args.forEach(arg => {
        arg.name = wasmExports.lookup_symbol(pointer, arg.name)
      })
      return sig
    }

    compile(sourceCode) {
      const {
        wasmExports,
        pointer,
        allocatedScripts,
      } = this[priv]
      const script = new Script(wasmExports, wasmExports.compile(pointer, sourceCode))
      allocatedScripts.add(script)
      return script
    }

    destroy() {
      const {
        wasmExports,
        pointer,
        allocatedScripts,
      } = this[priv]
      this[priv] = null
      allocatedScripts.forEach(script => script[drop]());
      wasmExports.drop_ns(pointer);
    }
  }

  class Script {
    constructor(wasmExports, pointer) {
      this[priv] = {
        wasmExports,
        pointer,
      }
    }

    typeInfo() {
      this._ensureLive()
      const {
        wasmExports,
        pointer
      } = this[priv];
      return unwrap(wasmExports.type_info(pointer))
    }

    eval(inputs = {}) {
      this._ensureLive()
      const {
        wasmExports,
        pointer
      } = this[priv];
      return corvus2js(wasmExports, unwrap(wasmExports.evaluate(pointer, mapValues(inputs, js2corvus))))
    }

    recompile(code) {
      this._ensureLive()
      const {
        wasmExports,
        pointer
      } = this[priv];
      wasmExports.recompile(pointer, code)
    }

    _ensureLive() {
      if (!this[priv]) {
        throw new Error(`This script has been dropped`)
      }
    }

    [drop]() {
      const {
        wasmExports,
        pointer
      } = this[priv];
      this[priv] = null
      wasmExports.drop_script(pointer)
    }
  }

  class Args {
    constructor(wasmExports, symbolMap, rawArgs) {
      this[priv] = {
        wasmExports,
        symbolMap,
        rawArgs,
        blockCallbacks: []
      };
    }

    demand(name) {
      const value = this.maybe(name, ArgMissing);
      if (value === ArgMissing) {
        throw new Error(`Argument "${name}" not provided`)
      }
      return value
    }

    maybe(name, fallback) {
      const {
        rawArgs,
        symbolMap,
        wasmExports
      } = this[priv];
      if (arguments.length < 2) {
        throw new Error(`args.maybe(${JSON.stringify(name)}) called without fallback`)
      }
      let argId = symbolMap.get(name)
      if (!argId) {
        throw new Error(`${JSON.stringify(name)} is not a valid argument name for this function. Valid argument names are ${Array.from(symbolMap.keys())}`)
      }
      for (let i = 0, len = rawArgs.length; i < len; i++) {
        debugger
        if (rawArgs[i][0] === argId) {
          const jsVal = corvus2js(wasmExports, rawArgs[i][1]);
          if (typeof jsVal === 'functions') {
            this[priv].blockCallbacks.push(jsVal)
          }
          return jsVal
        }
      }
      return fallback
    }

    *[Symbol.iterator]() {
      const rawArgs = this[priv].rawArgs;
      const id2name = new Map()
      for (let [name, id] of this[priv].symbolMap.entries()) {
        id2name.set(id, name)
      }
      for (let i = 0, len = rawArgs.length; i < len; i++) {
        const jsVal = corvus2js(wasmExports, rawArgs[i][1]);
        if (typeof jsVal === 'functions') {
          this[priv].blockCallbacks.push(jsVal)
        }
        yield [id2name.get(rawArgs[i][0]), jsVal]
      }
    }

    [drop]() {
      this[priv].blockCallbacks.forEach(callback => {
        callback[drop]()
      })
    }
  }

  const corvus2js = (wasmExports, [val, blockPtr]) => {
    if (blockPtr) {
      return createBlockWrapper(wasmExports, blockPtr);
    }
    return val
  }

  const createBlockWrapper = (wasmExports, blockPtr) => {
    const block = (...args) => {
      if (block.dropped) {
        throw new Error('Called dead block')
      }
      args = args.map(js2corvus);
      const result = wasmExports.call_block(blockPtr, args)
      return corvus2js(wasmExports, unwrap(result))
    }
    block.dropped = false
    block[drop] = () => {
      block.dropped = true
      wasmExports.drop_block(rawBlockPtr)
    }
    return block
  }

  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    const wasmExports = require('../target/wasm32-unknown-unknown/release/corvus_js.js');
    module.exports = () => new Namespace(wasmExports)
  } else if (typeof Rust !== 'undefined' && typeof window !== 'undefined') {
    window.createCorvus = () => Rust.corvus_js.then(wasmExports => new Namespace(wasmExports))
  } else {
    throw new Error('Unsupported environment')
  }
})()