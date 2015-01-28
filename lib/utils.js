var validUrl = require('valid-url');
var mpath = require('mpath');

exports.getRefValue = function (ref) {
  if (ref && ref.value && ref.value.$ref && typeof ref.value.$ref === 'string') {
    return ref.value.$ref;
  }
  return;
};

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