var validUrl = require('valid-url');
var mpath = require('mpath');
var path = require('path');

var isWindows = process.platform === 'win32';

/**
 * Gets the ref value of a search result from prop-search or ref object
 * @param ref The search result object from prop-search
 * @returns {*} The value of $ref or undefined if not present in search object
 */
exports.getRefValue = function (ref) {
  var thing = ref ? (ref.value ? ref.value : ref) : null;
  if (thing && thing.$ref && typeof thing.$ref === 'string') {
    return thing.$ref;
  }

  return;
};

/**
 * Gets the type of $ref from search result object.
 * @param ref The search result object from prop-search or a ref object
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
    return keys.length === 1 && keys[0] === '$ref' && typeof thing['$ref'] === 'string';
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

  if (rpath.charAt(0) === '/') {
    rpath = rpath.substring(1);
  }

  if (rpath.indexOf('/') >= 0) {
    rpath = rpath.replace(/\//gi, '.');
  }

  if (rpath) {
    return mpath.get(rpath, schema);
  }
  return schema;
};

exports.getRefFilePath = function (refPath) {
  var filePath = refPath;
  var hashIndex = filePath.indexOf('#');
  if (hashIndex > 0) {
    filePath = refPath.substring(0, hashIndex);
  }

  return filePath;
};

// Regex to split a windows path into three parts: [*, device, slash,
// tail] windows-only
const splitDeviceRe =
  /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;

function win32StatPath(path) {
  var result = splitDeviceRe.exec(path),
    device = result[1] || '',
    isUnc = !!device && device[1] !== ':';
  return {
    device: device,
    isUnc: isUnc,
    isAbsolute: isUnc || !!result[2], // UNC paths are always absolute
    tail: result[3]
  };
}

exports.isAbsolute = typeof path.isAbsolute === 'function' ? path.isAbsolute : function utilIsAbsolute(path) {
  if (isWindows) {
    return win32StatPath(path).isAbsolute;
  } else {
    return !!path && path[0] === '/';
  }
};