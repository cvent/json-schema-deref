var _ = require('lodash');
var clone = require('clone');
var utils = require('./utils');
var traverse = require('traverse-async').traverse;

var noop = function () {
};

var defaults = {
  cache: true,
  cacheTTL: 300000, // ms
  baseFolder: process.cwd()
};

var defaultKeys = Object.keys(defaults);

var jsonSchemaKeywords = ['member', 'property', 'schema', 'targetschema', 'type', 'element', 'properties',
  'definitions'];

var loaders = {
  'web': require('./loaders/web'),
  'file': require('./loaders/file')
};

var cache = {};

function getRefSchema(refVal, refType, parent, options, state, fn) {
  var customLoaderOptions = _.pick(options, defaultKeys);

  var loader = typeof options.loader === 'function' ? options.loader : null;

  function loaderHandler(err, loaderValue) {
    if (!err && loaderValue) {
      derefSchema(loaderValue, options, state, function (err, derefedValue) {
        if (err) {
          return fn(err);
        }

        var newVal;

        if (refVal.indexOf('#') >= 0) {
          var refPaths = refVal.split('#');
          var refPath = refPaths[1];
          var refNewVal = utils.getRefPathValue(derefedValue, refPath);
          if (refNewVal) {
            newVal = refNewVal;
          }
        }
        else {
          newVal = derefedValue;
        }

        return fn(null, newVal);
      });
    }
    else if (loader) {
      loader(refVal, customLoaderOptions, fn);
    }
    else {
      fn(err);
    }
  }

  var filePath = utils.getRefFilePath(refVal);

  if (refType && loaders[refType]) {
    var loaderValue;
    if (cache[filePath]) {
      loaderValue = cache[filePath];
      loaderHandler(null, loaderValue);
    }
    else {
      loaders[refType](refVal, options, loaderHandler);
    }
  }
  else if (refType === 'local') {
    var newValue = utils.getRefPathValue(parent, refVal);
    fn(undefined, newValue);
  }
  else if (loader) {
    loader(refVal, customLoaderOptions, fn);
  }
  else {
    fn();
  }
}


/**
 * Builds parental history of a node within an object. To be used in traversal.
 * @param node
 * @returns {*}
 */
function buildNodeHistory(node) {
  if (!node) {
    return [];
  }

  return _.chain(node.path).map(function (pathObj) {
    return pathObj.toLowerCase();
  }).difference(jsonSchemaKeywords).value();
}

/**
 * Derefs schema
 * @param schema
 * @param options
 * @param state
 * @param fn
 */
function derefSchema(schema, options, state, fn) {
  if (typeof state === 'function') {
    fn = state;
    state = null;
  }

  if (!state) {
    state = {
      circular: false,
      history: [],
      circularRefs: []
    };
  }

  if (state.circular) {
    console.log('circular');
    return fn(new Error('circular references found: ' + state.circularRefs.toString()), null);
  }

  function finalCb(newObject) {
    var error;
    if (state.circular) {
      error = new Error('circular references found: ' + state.circularRefs.toString());
    }
    return fn(error, newObject);
  }

  var queue = traverse(schema, function (node, next) {
    if (node['$ref'] && typeof node['$ref'] === 'string') {
      var self = this;

      var refType = utils.getRefType(node);
      var refVal = utils.getRefValue(node);

      var nodeHistory = buildNodeHistory({path: this.path.slice(0, -1)});

      var refPaths = refVal.split('/');
      var finalRef = refPaths[refPaths.length - 1] ? refPaths[refPaths.length - 1].toLowerCase() : null;

      if ((refType === 'local' && finalRef && nodeHistory.indexOf(finalRef) >= 0) ||
        (state.history.indexOf(refVal) >= 0)) {
        state.circular = true;
        state.circularRefs.push(refVal);
        return next();
      }

      state.history.push(refVal);

      getRefSchema(refVal, refType, schema, options, state, function (err, newValue) {
        if (!err && newValue) {
          var obj;

          if (self.parent && self.parent[self.key]) {
            obj = self.parent;
          }
          else if (self.node && self.node[self.key]) {
            obj = self.node;
          }

          if (obj && newValue) {
            obj[self.key] = newValue;
            if (state.circularRefs.indexOf(refVal) === -1) {
              state.history.pop();
            }
          }
          else if (self.isRoot && (newValue)) {
            // special case of root schema being replaced
            queue.break();
            return finalCb(newValue)
          }

          return next();
        }
        else {
          return next();
        }
      });
    }
    else {
      return next();
    }
  }, finalCb);
}

/**
 * Derefs `$ref`'s in json schema to actual resolved values.
 * Supports local, file and web refs.
 * @param schema The json schema
 * @param options
 *          baseFolder - the base folder to get relative path files from. Default is `process.cwd()`
 *          cache - whether to cache the result from the request. true if to cache, false otherwise.
 *          cacheTTL - the time to keep request result in cache. Default is 5 minutes.
 *          loader - a function for custom loader. Invoked if we could not resolve the ref type, or if there was an
 *                   error resolving a web or file ref types.
 *                   function with signature: `function(refValue, options, fn)`
 *                      refValue - the string value of the ref being resolved. Ex: `db://my_database_id`
 *                      options - options parameter passed to `deref`
 *                      fn - the final callback function, in form `function(err, newValue)`
 *                           err - err if ref is valid for the loader but there was an error resolving the ref
 *                           newValue - the resolved ref value, or null/undefined if the ref isn't for this custom
 *                                      loader and we should just leave the $ref as is.
 * @param fn
 * @returns {*}
 */
function deref(schema, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  if (!fn) fn = noop;

  options = _.defaults(options, defaults);

  var baseSchema = clone(schema);

  cache = {};

  return derefSchema(baseSchema, options, fn);
}

deref.prototype.getRefPathValue = utils.getRefPathValue;

module.exports = deref;