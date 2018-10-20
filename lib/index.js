const path = require('path')
const { parse } = require('url')
const _ = require('lodash')
const clone = require('clone')
const { traverse } = require('traverse-async')
const traverseSync = require('traverse')
const DAG = require('dag-map')
const md5 = require('md5')
const utils = require('./utils')
const webLoader = require('./loaders/web')
const fileLoader = require('./loaders/file')

const defaults = {
  cache: true,
  cacheTTL: 300000, // ms
  baseFolder: process.cwd()
}

const defaultKeys = Object.keys(defaults)

let cache = {}

const loaders = {
  web: webLoader,
  file: fileLoader
}

/**
 * Returns the reference schema that refVal points to.
 * If the ref val points to a ref within a file, the file is loaded and fully derefed, before we get the
 * pointing property. Derefed files are cached. Derefed web urls are cached according to options.
 *
 * @param refVal
 * @param refType
 * @param parent
 * @param options
 * @param state
 * @param fn
 * @private
 */
function getRefSchema (refVal, refType, parent, options, state, fn) {
  const customLoaderOptions = _.pick(options, defaultKeys)
  const loader = typeof options.loader === 'function' ? options.loader : null
  let filePath
  let fullRefFilePath

  if (refType === 'file') {
    filePath = utils.getRefFilePath(refVal)
    fullRefFilePath = utils.isAbsolute(filePath) ? filePath : path.resolve(state.cwd, filePath)
  }

  function loaderHandler (err, loaderValue) {
    if (!err && loaderValue) {
      let oldBasePath

      if (refType === 'file') {
        let dirname = path.dirname(filePath)
        if (dirname === '.') {
          dirname = ''
        }

        if (dirname) {
          oldBasePath = state.cwd
          const newBasePath = path.resolve(state.cwd, dirname)
          options.baseFolder = state.cwd = newBasePath
        }
      }

      derefSchema(loaderValue, options, state, (err, derefedValue) => {
        // reset
        if (oldBasePath) {
          options.baseFolder = state.cwd = oldBasePath
        }

        if (err) {
          return fn(err)
        }

        let newVal
        if (derefedValue) {
          if (refType === 'file' && fullRefFilePath && !cache[fullRefFilePath]) {
            cache[fullRefFilePath] = derefedValue
          }

          if (refVal.indexOf('#') >= 0) {
            const refPaths = refVal.split('#')
            const refPath = refPaths[1]
            const refNewVal = utils.getRefPathValue(derefedValue, refPath)
            if (refNewVal) {
              newVal = refNewVal
            }
          } else {
            newVal = derefedValue
          }
        }

        return fn(null, newVal)
      })
    } else if (loader) {
      loader(refVal, customLoaderOptions, fn)
    } else {
      fn(err)
    }
  }

  if (refType && loaders[refType]) {
    let loaderValue
    if (refType === 'file') {
      if (cache[fullRefFilePath]) {
        loaderValue = cache[fullRefFilePath]
        loaderHandler(null, loaderValue)
      } else {
        loaders[refType](refVal, options, loaderHandler)
      }
    } else {
      loaders[refType](refVal, options, loaderHandler)
    }
  } else if (refType === 'local') {
    const newValue = utils.getRefPathValue(parent, refVal)
    fn(undefined, newValue)
  } else if (loader) {
    loader(refVal, customLoaderOptions, fn)
  } else {
    fn()
  }
}

/**
 * Add to state history
 * @param {Object} state the state
 * @param {String} type ref type
 * @param {String} value ref value
 * @private
 */
function addToHistory (state, type, value) {
  let dest

  if (type === 'web') {
    const url = parse(value)
    dest = url.host.concat(url.path)
  } else if (type === 'file') {
    dest = utils.getRefFilePath(value)
  } else {
    if (value === '#') {
      return false
    }
    dest = state.current.concat(`:${value}`)
  }

  if (dest) {
    dest = dest.toLowerCase()
    if (state.history.indexOf(dest) >= 0) {
      return false
    }

    state.history.push(dest)
  }
  return true
}

/**
 * Set the current into state
 * @param {Object} state the state
 * @param {String} type ref type
 * @param {String} value ref value
 * @private
 */
function setCurrent (state, type, value) {
  let dest
  if (type === 'web') {
    const url = parse(value)
    dest = url.host.concat(url.path)
  } else if (type === 'file') {
    dest = utils.getRefFilePath(value)
  }

  if (dest) {
    state.current = dest
  }
}

/**
 * Check the schema for local circular refs using DAG
 * @param {Object} schema the schema
 * @return {Error|undefined} <code>Error</code> if circular ref, <code>undefined</code> otherwise if OK
 * @private
 */
function checkLocalCircular (schema) {
  const dag = new DAG()
  const locals = traverseSync(schema).reduce(function (acc, node) {
    if (!_.isNull(node) && !_.isUndefined(null) && typeof node.$ref === 'string') {
      const refType = utils.getRefType(node)
      if (refType === 'local') {
        const value = utils.getRefValue(node)
        if (value) {
          const path = this.path.join('/')
          acc.push({
            from: path,
            to: value
          })
        }
      }
    }
    return acc
  }, [])

  if (!locals || !locals.length) {
    return
  }

  if (_.some(locals, elem => elem.to === '#')) {
    return new Error('Circular self reference')
  }

  const check = _.find(locals, elem => {
    const from = elem.from.concat('/')
    const dest = elem.to.substring(2).concat('/')
    try {
      dag.addEdge(from, dest)
    } catch (err) {
      return elem
    }

    if (from.indexOf(dest) === 0) {
      return elem
    }
  })

  if (check) {
    return new Error(`Circular self reference from ${check.from} to ${check.to}`)
  }
}

/**
 * Derefs $ref types in a schema
 * @param schema
 * @param options
 * @param state
 * @param type
 * @param fn
 * @private
 */
function derefSchema (schema, options, state, fn) {
  if (typeof state === 'function') {
    fn = state
    state = {}
  }

  const check = checkLocalCircular(schema)
  if (check instanceof Error) {
    return fn(check)
  }

  if (state.circular) {
    return fn(new Error(`circular references found: ${state.circularRefs.toString()}`), null)
  } else if (state.error) {
    return fn(state.error)
  }

  function final (newObject) {
    let error
    if (state.circular) {
      error = new Error(`circular references found: ${state.circularRefs.toString()}`)
    } else if (state.error && options.failOnMissing) {
      error = state.error
    }
    return fn(error, newObject)
  }

  const queue = traverse(
    schema,
    function (node, next) {
      const self = this
      if (_.isNull(node) || _.isUndefined(null)) {
        return next()
      }

      if (typeof node.$ref !== 'string') {
        return next()
      }

      const refType = utils.getRefType(node)
      const refVal = utils.getRefValue(node)

      const addOk = addToHistory(state, refType, refVal)
      if (!addOk) {
        state.circular = true
        state.circularRefs.push(refVal)
        return next()
      }

      setCurrent(state, refType, refVal)
      getRefSchema(refVal, refType, schema, options, state, (err, newValue) => {
        if (err) {
          state.error = err
          if (state.circular) {
            return final(schema)
          }
          if (options.failOnMissing) {
            return final(schema)
          }
        }

        state.history.pop()

        if (!err && _.isUndefined(newValue)) {
          if (state.missing.indexOf(refVal) === -1) {
            state.missing.push(refVal)
          }
          if (options.failOnMissing) {
            state.error = new Error(`Missing $ref: ${refVal}`)
            return final(schema)
          }
          return next()
        }

        let obj

        if (self.parent && self.parent[self.key]) {
          obj = self.parent
        } else if (self.node && self.node[self.key]) {
          obj = self.node
        }

        if (obj && !_.isUndefined(newValue)) {
          if (options.mergeAdditionalProperties) {
            delete node.$ref
            newValue = Object.assign({}, newValue, node)
          }

          if (options.removeIds && newValue.hasOwnProperty('$id')) {
            delete newValue.$id
          }

          obj[self.key] = newValue

          if (state.missing.indexOf(refVal) !== -1) {
            state.missing.splice(state.missing.indexOf(refVal), 1)
          }
        } else if (self.isRoot && !_.isUndefined(newValue)) {
          // special case of root schema being replaced
          state.history.pop()
          if (state.missing.indexOf(refVal) === -1) {
            state.missing.push(refVal)
          }

          queue.break()
          return final(newValue)
        }

        return next()
      })
    },
    final
  )
}

/**
 * Derefs <code>$ref</code>'s in JSON Schema to actual resolved values. Supports local, file and web refs.
 * @param {Object} schema - The JSON schema
 * @param {Object} options - options
 * @param {String} options.baseFolder - the base folder to get relative path files from. Default is <code>process.cwd()</code>
 * @param {String} options.cache - whether to cache the result from the request. Default: <code>true</code>.
 * @param {Number} options.cacheTTL - the time to keep request result in cache. Default is <code>5 minutes</code>.
 * @param {Boolean} options.failOnMissing - By default missing / unresolved refs will be left as is with their ref value intact.
 *                                        If set to <code>true</code> we will error out on first missing ref that we cannot
 *                                        resolve. Default: <code>false</code>.
 * @param {Function} options.loader - a function for custom loader. Invoked if we could not resolve the ref type,
 *                                  or if there was an error resolving a web or file ref types.
 *                                  function with signature: <code>function(refValue, options, fn)</code>
 *                                  <code>refValue</code> - the string value of the ref being resolved. Ex: <code>db://my_database_id</code>
 *                                  <code>options</code> - options parameter passed to <code>deref</code>
 *                                  <code>fn</code> - the final callback function, in form <code>function(err, newValue)</code>
 *                                  <code>err</code> - error if ref is valid for the loader but there was an error resolving the ref.
 *                                  If used in combination with <code>failOnMissing</code> option it will abort the whole deref process.
 *                                  <code>newValue</code> - the resolved ref value, or <code>null</code> or <code>undefined</code> if the ref isn't for this custom
 *                                  <code>loader</code> and we should just leave the <code>$ref</code> as is.
 * @param {Boolean} options.mergeAdditionalProperties - By default properties in a object with $ref will be removed in the output.
 *                                                    If set to <code>true</code> they will be added/overwrite the output.
 *                                                    Default: <code>false</code>.
 * @param {Boolean} options.removeIds - By default <code>$id</code> fields will get copied when dereferencing.
 *                                    If set to <code>true</code> they will be removed.
 *                                    Default: <code>false</code>.
 * @param fn {Function} The final callback in form <code>(error, newSchema)</code>
 */
function deref (schema, options, fn) {
  if (typeof options === 'function') {
    fn = options
    options = {}
  }

  if (!fn) {
    fn = _.noop
  }

  options = _.defaults(options, defaults)

  const bf = options.baseFolder
  let cwd = bf
  if (!utils.isAbsolute(bf)) {
    cwd = path.resolve(process.cwd(), bf)
  }

  const state = {
    graph: new DAG(),
    circular: false,
    circularRefs: [],
    cwd,
    missing: [],
    history: []
  }

  try {
    const str = JSON.stringify(schema)
    state.current = md5(str)
  } catch (err) {
    return fn(err)
  }

  const baseSchema = clone(schema)

  cache = {}

  return derefSchema(baseSchema, options, state, fn)
}

module.exports = deref
