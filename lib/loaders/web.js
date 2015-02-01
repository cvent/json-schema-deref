var request = require('request');
var urlUtil = require('url');
var cache = require('memory-cache');
var clone = require('clone');

var utils = require('../utils');

var noop = function () {
};

var defaultTTL = 300000; // ms

/**
 * Resolves a web link of a json schema to the actual value it references
 * It ignores web links to anywhere under json-schema.org host
 * @param url the ref url value. String. Ex. `http://www.mysite.com/schema.json#/definitions/foo`
 * @param options
 *              cache - whether to cache the result from the request. true if to cache, false otherwise.
 *              cacheTTL - the time to keep request result in cache. Default is 5 minutes.
 * @param fn  callback (err, newValue)
 *              `newValue` is resolved value. If not found it's undefined
 * @returns {*}
 */
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
    return fn();
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