const { parse } = require('url')
const request = require('request')
const cache = require('memory-cache')
const clone = require('clone')

const noop = function noop () {}

const defaultTTL = 300000 // ms

/**
 * Resolves a web link of a json schema to the actual value it references
 * It ignores web links to anywhere under json-schema.org host
 * @param {String} url the ref url value. String. Ex. `http://www.mysite.com/schema.json#/definitions/foo`
 * @param {Object} options the options
 * @param {Boolean} options.cache whether to cache the result from the request. true if to cache, false otherwise.
 * @param {Number} options.cacheTTL the time to keep request result in cache. Default is 5 minutes.
 * @param {Function} fn callback (err, newValue). `newValue` is resolved value. If not found it's undefined
 * @private
 */
module.exports = function (url, options, fn) {
  if (!fn) {
    fn = noop
  }

  if (options.cache !== false) {
    const cachedValue = cache.get(url)
    if (cachedValue) {
      return fn(null, clone(cachedValue))
    }
  }

  const urlObj = parse(url)
  if (urlObj.hostname === 'json-schema.org') {
    return fn()
  }

  let reqUrl = url
  const hashIndex = url.indexOf('#')
  if (hashIndex > 0) {
    reqUrl = url.substring(0, hashIndex)
  }

  request.get({ url: reqUrl, json: true }, (err, response, body) => {
    if (err) {
      return fn(err)
    }

    let newVal
    if (!err && body) {
      newVal = body
    }

    if (options.cache !== false) {
      cache.put(url, newVal, options.cacheTTL || defaultTTL)
    }

    return fn(err, newVal)
  })
}
