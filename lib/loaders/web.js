var request = require('request');
var urlUtil = require('url');
var cache = require('memory-cache');
var clone = require('clone');

var utils = require('../utils');

var noop = function () {
};

var defaultTTL = 120000; // ms

module.exports = function (url, options, fn) {
  if (!fn) fn = noop;

  if (options.cache !== false) {
    var cachedValue = cache.get(url);
    if (cachedValue) {
      return fn(null, clone(cachedValue));
    }
  }

  var urlObj = urlUtil.parse(url);
  if (urlObj.hostname === 'json-schema.org') {
    return fn(null);
  }

  var reqUrl = url;
  var hashIndex = url.indexOf('#');
  if (hashIndex > 0) {
    reqUrl = url.substring(0, hashIndex);
  }

  request.get({url: reqUrl, json: true}, function (err, response, body) {
    var newVal;
    if (!err && body) {
      newVal = body;
      if (hashIndex > 0) {
        var refPath = url.substring(hashIndex);
        var refNewVal = utils.getRefPathValue(body, refPath);
        if (refNewVal) {
          newVal = refNewVal;
        }
      }
    }

    if (options.cache !== false) {
      cache.put(url, newVal, options.cacheTTL || defaultTTL);
    }

    return fn(err, newVal);
  });
};