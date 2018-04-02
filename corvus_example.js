window.CorvusExample = (function () {
  let exampleCounter = 0;

  function init(div, namespace, number) {
    var code = div.innerText.trim();
    const noInputs = div.dataset.noInputs == 'true';
    div.innerText = null;

    if (div.dataset.title) {
      const title = div.appendChild(document.createElement('h3'));
      title.innerText = "Example #" + number + ": " + div.dataset.title;
    }
    const codeBox = CodeMirror(div, {
      value: code,
    });
    const inputsDiv = div.appendChild(document.createElement('div'));
    let inputsEditor = null;
    if (div.dataset.title) {
      const resultsLabel = div.appendChild(document.createElement('h3'));
      resultsLabel.innerText = 'Result:'
    }
    const resultsBox = div.appendChild(document.createElement('pre'));
    resultsBox.classList.add('result')
    resultsBox.innerText = "?"

    const scheduleCompile = debounce(doCompile);
    let lastEval = ''
    let lastResult = null
    let lastCompileFailed = false

    let script = namespace.compile(code)
    let typeInfo = script.typeInfo()
    updateSchema(typeInfo.inputs);
    let marks = []

    codeBox.on('change', () => scheduleCompile());

    return {
      eval: doEval,
      typeOf: () => typeInfo,
      codeBox: codeBox,
    }

    function doCompile() {
      try {
        let code = codeBox.getDoc().getValue();
        script.recompile(code.trim());
        typeInfo = script.typeInfo();
        lastCompileFailed = false;
        while (marks.length) {
          marks.shift().clear()
        }
        if (typeInfo.errors.length > 0) {
          typeInfo.errors.forEach(({
            error,
            location: {
              start_pos,
              end_pos
            }
          }) => {
            marks.push(codeBox.markText(toPos(code, start_pos), toPos(code, end_pos), {
              className: 'error',
              title: humanizeTypeError(error, code.substr(start_pos, end_pos - start_pos))
            }))
          });
        }
        resultsBox.classList.remove('error');
        resultsBox.innerText = '?'
        updateSchema(typeInfo.inputs);
      } catch (err) {
        lastCompileFailed = true
        showError(err.message)
      }
    }

    function doEval() {
      if (typeInfo.errors.length > 0) {
        return lastResult
      }
      try {
        lastResult = script.eval(inputsEditor ? inputsEditor.getValue() : {});
        resultsBox.innerText = JSON.stringify(lastResult, null, 2);
        resultsBox.style.transition = 'all 0s';
        resultsBox.classList.remove('error');
        resultsBox.classList.add('flashy');
        setTimeout(() => {
          resultsBox.style.transition = 'all 1s';
          setTimeout(() => {
            resultsBox.classList.remove('flashy')
          }, 100)
        }, 100)
      } catch (err) {
        showError(err.message)
      }
    }

    function toPos(text, offset) {
      const lines = text.split('\n')
      let line = 0;
      let ch = offset;
      while (lines.length > 0 && lines[0].length < ch) {
        ch -= lines.shift().length;
      }
      return {
        line,
        ch
      }
    }

    function humanizeTypeError(error, sourceCode) {
      if (error === 'UnknownFunction') {
        return `I don't know any function named "${sourceCode.split(':')[0]}"`
      }
      if (error.UnknownKeyword) {
        const sig = namespace.getSignature(error.UnknownKeyword)
        let maybeYouMeant = ''
        if (sig) {
          const candidates = sig.args.slice(1).map(arg => [levenshteinD(sourceCode, arg.name), arg.name])
            .sort(([a], [b]) => a - b)
            .slice(0, 4)
            .map(([_, kw]) => kw)
          if (candidates.length > 0) {
            maybeYouMeant = `. Maybe you meant ${oxford(candidates)}?`
          }
        }
        return `the ${error.UnknownKeyword} function doesn't understand this keyword${maybeYouMeant}`
      }
      if (error.Constraint) {
        const [typeLocation, problem] = error.Constraint
        if (problem.Incompatible) {
          const [actual, expected] = problem.Incompatible;
          return `this needs to be ${humanizeType(expected)} instead of ${humanizeType(actual)}`
        }
        if (problem.BlockArity) {
          const {
            expected,
            actual
          } = problem.BlockArity;
          return `this block requires ${actual} arguments but the function will only provide ${expected}`
        }
        if (problem.FieldMissing) {
          return `this record must contain a field named ${problem.FieldMissing}`
        }
        if (problem.FieldOptional) {
          return `the ${problem.FieldOptional} field of this record is not guaranteed to be present`
        }
      }
      return JSON.stringify(error)
    }

    function humanizeType(type, ctx) {
      switch (type) {
        case 'Num':
          return ctx == 'List' ? 'numbers' : 'a number'
        case 'Str':
          return ctx == 'List' ? 'texts' : 'text'
        case 'Bool':
          return 'true or false'
        case 'Time':
          return ctx == 'List' ? 'times' : 'time'
      }
      if (type.List) {
        return `${ctx == 'List' ? 'lists' : 'list'} of ${humanizeType(type.List, 'List')}`
      }
      if (type.Record) {

      }
    }

    function showError(message) {
      resultsBox.classList.add('error');
      resultsBox.innerText = message
    }

    function updateSchema(inputTypes) {
      const inputNames = Object.keys(inputTypes)
      if (inputNames.length === 0) {
        if (inputsEditor) {
          inputsEditor.destroy();
          inputsEditor = null;
        }
        return;
      }
      // todo - smarter detection of "has this schema changed?"
      let oldValue = inputsEditor ? inputsEditor.getValue() : {}
      let newValue = {}
      const schema = {
        type: 'object',
        title: 'Inputs',
        required: inputNames,
        properties: inputNames.reduce((props, key) => {
          props[key] = type2schema(inputTypes[key], oldValue, newValue)
          if (oldValue.hasOwnProperty(key)) {
            newValue[key] = oldValue[key]
          }
          return props
        }, {})
      };
      if (inputsEditor) {
        inputsEditor.destroy()
      }
      inputsEditor = new JSONEditor(inputsDiv, {
        theme: 'corvus',
        schema: schema,
        startval: newValue,
        disable_edit_json: true,
        disable_collapse: true,
        disable_properties: true,
        display_required_only: true,
        no_additional_properties: true,
      })
    }
  }


  function type2schema(type) {
    if (typeof type === 'string') {
      switch (type) {
        case 'Num':
          return {
            type: 'number'
          }
        case 'Str':
          return {
            type: 'string'
          }
        case 'Bool':
          return {
            type: 'boolean'
          }
        case 'Time':
          return {
            type: 'number',
          }
        default:
          throw new Error('unhandled primitive type: ' + type)
      }
    }
    if (type.Record) {
      const schema = {
        type: 'object',
        required: [],
        properties: {}
      }
      Object.keys(type.Record[1]).forEach(key => {
        const field = type.Record[1][key];
        if (!field.optional) {
          schema.required.push(key);
        }
        schema.properties[key] = type2schema(field.ty);
      })
      if (schema.required.length === 0) {
        delete schema.required
      }
      return schema
    }
    if (type.List) {
      return {
        type: 'array',
        items: type2schema(type.List)
      }
    }
    if (type.Var) {
      return {
        type: ['string', 'number', 'boolean']
      }
    }
  }

  function debounce(f) {
    let timeout = null
    return (evt) => {
      if (timeout === null) {
        f(evt)
      } else {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          f(evt)
          timeout = null
        }, 200)
      }
    }
  }

  // from npmjs.com/package/meant
  function levenshteinD(s1, s2) {
    var d = []
    var i = 0

    for (i = 0; i <= s1.length; i++) d[i] = [i]
    for (i = 0; i <= s2.length; i++) d[0][i] = i

    s2.split('').forEach(function (c2, j) {
      s1.split('').forEach(function (c1, i) {
        if (c1 === c2) {
          d[i + 1][j + 1] = d[i][j]
          return
        }
        d[i + 1][j + 1] = Math.min(
          d[i][j + 1] + 1,
          d[i + 1][j] + 1,
          d[i][j] + 1
        )
      })
    })

    return d[s1.length][s2.length]
  }

  // from npmjs.com/package/meant
  function meant(scmd, commands) {
    var d = []
    var bestSimilarity = []

    commands.forEach(function (cmd, i) {
      var item = {}
      item[levenshteinD(scmd, cmd)] = i
      d.push(item)
    })

    d.sort(function (a, b) {
      return Number(Object.keys(a)[0]) - Number(Object.keys(b)[0])
    })

    d.forEach(function (item) {
      var key = Number(Object.keys(item)[0])
      if (scmd.length / 2 >= key) {
        bestSimilarity.push(commands[item[key]])
      }
    })

    return bestSimilarity
  }

  function oxford(list, connective = 'or') {
    switch (list.length) {
      case 0:
        return ''
      case 1:
        return list[0]
      case 2:
        return `${list[1]} ${connective} ${list[2]}`
      default:
        return `${list.slice(0, -1).join(', ')} ${connective} ${list[list.length-1]}`
    }
  }


  const examples = new Map();

  const withContainingExample = (node, callback) => {
    while (node) {
      if (node.classList && node.classList.contains('example')) {
        break
      }
      node = node.parentNode
    }
    if (!node) {
      return
    }
    const example = examples.get(node);
    if (!example) {
      console.error("Example was not properly initialized?", node)
      return
    }
    callback(example)
  }

  createCorvus().then(bird => {
    window.bird = bird;
    bird.define(fn => {
      fn.requireArg('alert', 'string');
      fn.returns('string');
      fn.neverFails();
      fn.handler(args => {
        const message = args.demand('alert')
        alert(message)
        return message
      });
    })

    Array.prototype.slice.call(document.querySelectorAll('div.example')).forEach((div, i) => {
      const example = init(div, bird, i + 1);
      examples.set(div, example)
    })

    window.addEventListener('keypress', event => {
      if (!(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
        return
      }
      withContainingExample(event.target, example => {
        // timeout so that 'change' events to inputs can propagate first
        setTimeout(() => example.eval(true), 1)
      })
    })
  })
})()