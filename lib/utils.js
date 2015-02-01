var validUrl = require('valid-url');
var mpath = require('mpath');

/**
 * Gets the ref value of a search result from prop-searh
 * @param ref The search result object from prop-search
 * @returns {*} The value of $ref or undefined if not present in search object
 */
exports.getRefValue = function (ref) {
  if (ref && ref.value && ref.value.$ref && typeof ref.value.$ref === 'string') {
    return ref.value.$ref;
  }
  return;
};

/**
 * Gets the type of $ref from search result object.
 * @param ref The search result object from prop-search
 * @returns {string}  `web` if it's a web url.
 *                    `file` if it's a file path.
 *                    `local` if it's a link to local schema.
 *                    undefined otherwise
 */
exports.getRefType = function (ref) {
  var val = exports.getRefValue(ref);
  if (val) {
    if (validUrl.isWebUri(val)) {
      return 'web';
    }
    if ((validUrl.isUri(val) && val.indexOf('file:') === '0') || (val.indexOf('.json') > 0)) {
      return 'file';
    }
    if ((val.charAt(0) === '#') || (!validUrl.isUri(val))) {
      return 'local'
    }
  }
  return;
};

/**
 * Determines if object is a $ref object. That is { $ref: <something> }
 * @param thing object to test
 * @returns {boolean} true if passes the test. false otherwise.
 */
exports.isRefObject = function (thing) {
  if (thing && typeof thing === 'object' && !Array.isArray(thing)) {
    var keys = Object.keys(thing);
    return keys.length === 1 && keys[0] === '$ref';
  }
  return false;
};

/**
 * Gets the value at the ref path within schema
 * @param schema the (root) json schema to search
 * @param refPath string ref path to get within the schema. Ex. `#/definitions/id`
 * @returns {*} Returns the value at the path location or undefined if not found within the given schema
 */
exports.getRefPathValue = function (schema, refPath) {
  var rpath = refPath;
  var hashIndex = refPath.indexOf('#');
  if (hashIndex >= 0) {
    rpath = refPath.substring(hashIndex);
    if (rpath.length > 1) {
      rpath = refPath.substring(1);
    }
    else {
      rpath = '';
    }
  }

  if(rpath.charAt(0) === '/') {
    rpath = rpath.substring(1);
  }

  if (rpath.indexOf('/') >= 0) {
    rpath = rpath.replace(/\//gi, '.');
  }

  if(rpath) {
    return mpath.get(rpath, schema);
  }
  else return;
};