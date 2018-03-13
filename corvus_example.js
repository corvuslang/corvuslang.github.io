window.CorvusExample = (function () {
  let exampleCounter = 0;

  createCorvus().then(bird => {
    window.bird = bird;
    const examples = [].slice.call(document.querySelectorAll('div.example'));
    examples.forEach((div, i) => init(div, bird, i + 1));
  })

  function init(div, bird, number) {
    var code = div.innerText.trim();
    const noInputs = div.dataset.noInputs == 'true';
    div.innerText = null;

    if (div.dataset.title) {
      const title = div.appendChild(document.createElement('h3'));
      title.innerText = "Example #" + number + ": " + div.dataset.title;
    }
    const codeBox = div.appendChild(document.createElement('textarea'));
    const globalsDiv = div.appendChild(document.createElement('div'));
    let globalsEditor = null;
    if (div.dataset.title) {
      const resultsLabel = div.appendChild(document.createElement('h3'));
      resultsLabel.innerText = 'Result:'
    }
    const resultsBox = div.appendChild(document.createElement('pre'));
    resultsBox.classList.add('result')
    codeBox.value = code

    function onChange(evt) {
      const lines = codeBox.value.split('\n')
      const rows = lines.length
      const cols = Math.max(50, ...lines.map(line => line.length))
      if (codeBox.rows != rows) {
        codeBox.rows = rows;
      }
      if (codeBox.cols != cols) {
        codeBox.cols = cols
      }
      scheduleEval(evt)
    }

    const scheduleEval = debounce(doEval);

    function doEval(evt) {
      try {
        const code = codeBox.value.trim()
        const {
          output,
          inputs
        } = bird.typeOf(code);
        if (evt !== 'json-editor' && !noInputs) {
          updateSchema(inputs);
        }
        const result = bird.eval(code, globalsEditor ? globalsEditor.getValue() : {});
        resultsBox.classList.remove('error');
        resultsBox.innerText = JSON.stringify(result, null, 2);
      } catch (err) {
        resultsBox.classList.add('error');
        resultsBox.innerText = err.message
      }
    }

    function updateSchema(inputs) {
      const globals = Object.keys(inputs)
      if (globals.length === 0) {
        if (globalsEditor) {
          globalsEditor.destroy();
          globalsEditor = null;
        }
        return;
      }
      // todo - smarter detection of "has this schema changed?"
      let oldValue = globalsEditor ? globalsEditor.getValue() : {}
      let newValue = {}
      const schema = {
        type: 'object',
        title: 'Inputs',
        required: globals,
        properties: globals.reduce((props, key) => {
          props[key] = type2schema(inputs[key])
          if (oldValue.hasOwnProperty(key)) {
            newValue[key] = oldValue[key]
          }
          return props
        }, {})
      };
      if (globalsEditor) {
        globalsEditor.destroy()
      }
      globalsEditor = new JSONEditor(globalsDiv, {
        theme: 'corvus',
        schema: schema,
        startval: newValue,
        disable_edit_json: true,
        disable_collapse: true,
        disable_properties: true,
      })
      globalsEditor.on('change', () => onChange('json-editor'))
    }

    codeBox.addEventListener('keyup', onChange)
    onChange()
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
        schema.properties[key] = type2schema(field.output);
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
    return () => {
      if (timeout === null) {
        f()
      } else {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        f()
        timeout = null
      }, 200)
    }
  }

  return {
    init
  }
})()