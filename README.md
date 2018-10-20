# json-schema-deref

[![npm version](https://img.shields.io/npm/v/json-schema-deref.svg?style=flat-square)](https://www.npmjs.com/package/json-schema-deref)
[![build status](https://img.shields.io/travis/bojand/json-schema-deref/master.svg?style=flat-square)](https://travis-ci.org/bojand/json-schema-deref)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg?style=flat-square)](https://standardjs.com)
[![License](https://img.shields.io/github/license/bojand/json-schema-deref.svg?style=flat-square)](https://raw.githubusercontent.com/bojand/json-schema-deref/master/LICENSE)

Dereference JSON pointers in a JSON schemas with their true resolved values.
A lighter synchronous version of this module is available as [json-schema-deref-sync](https://github.com/bojand/json-schema-deref-sync),
but omits web references and custom loaders.

## Installation

`npm install json-schema-deref`

## Overview

Let's say you have the following JSON Schema:

```json
{
  "description": "Just some JSON schema.",
  "title": "Basic Widget",
  "type": "object",
  "definitions": {
    "id": {
      "description": "unique identifier",
      "type": "string",
      "minLength": 1,
      "readOnly": true
    }
  },
  "properties": {
    "id": {
      "$ref": "#/definitions/id"
    },
    "foo": {
      "$ref": "http://www.mysite.com/myschema.json#/definitions/foo"
    },
    "bar": {
      "$ref": "bar.json"
    }
  }
}
```

Sometimes you just want that schema to be fully expanded, with `$ref`'s being their (true) resolved values:

```json
{
  "description": "Just some JSON schema.",
  "title": "Basic Widget",
  "type": "object",
  "definitions": {
    "id": {
      "description": "unique identifier",
      "type": "string",
      "minLength": 1,
      "readOnly": true
    }
  },
  "properties": {
    "id": {
      "description": "unique identifier",
      "type": "string",
      "minLength": 1,
      "readOnly": true
    },
    "foo": {
      "description": "foo property",
      "readOnly": true,
      "type": "number"
    },
    "bar": {
      "description": "bar property",
      "type": "boolean"
    }
  }
}
```

This utility lets you do that:


```js
var deref = require('json-schema-deref');
var myschema = require('schema.json');

deref(myschema, function(err, fullSchema) {
  console.dir(fullSchema); // has the full expanded $refs
});
```

## API Reference

<a name="deref"></a>

### deref(schema, options, fn)
Derefs <code>$ref</code>'s in JSON Schema to actual resolved values. Supports local, file and web refs.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| schema | <code>Object</code> | The JSON schema |
| options | <code>Object</code> | options |
| options.baseFolder | <code>String</code> | the base folder to get relative path files from. Default is <code>process.cwd()</code> |
| options.cache | <code>String</code> | whether to cache the result from the request. Default: <code>true</code>. |
| options.cacheTTL | <code>Number</code> | the time to keep request result in cache. Default is <code>5 minutes</code>. |
| options.failOnMissing | <code>Boolean</code> | By default missing / unresolved refs will be left as is with their ref value intact.                                        If set to <code>true</code> we will error out on first missing ref that we cannot                                        resolve. Default: <code>false</code>. |
| options.loader | <code>function</code> | a function for custom loader. Invoked if we could not resolve the ref type,                                  or if there was an error resolving a web or file ref types.                                  function with signature: <code>function(refValue, options, fn)</code>                                  <code>refValue</code> - the string value of the ref being resolved. Ex: <code>db://my_database_id</code>                                  <code>options</code> - options parameter passed to <code>deref</code>                                  <code>fn</code> - the final callback function, in form <code>function(err, newValue)</code>                                  <code>err</code> - error if ref is valid for the loader but there was an error resolving the ref.                                  If used in combination with <code>failOnMissing</code> option it will abort the whole deref process.                                  <code>newValue</code> - the resolved ref value, or <code>null</code> or <code>undefined</code> if the ref isn't for this custom                                  <code>loader</code> and we should just leave the <code>$ref</code> as is. |
| options.mergeAdditionalProperties | <code>Boolean</code> | By default properties in a object with $ref will be removed in the output.                                                    If set to <code>true</code> they will be added/overwrite the output.                                                    Default: <code>false</code>. |
| options.removeIds | <code>Boolean</code> | By default <code>$id</code> fields will get copied when dereferencing.                                    If set to <code>true</code> they will be removed.                                    Default: <code>false</code>. |
| fn | <code>function</code> | The final callback in form <code>(error, newSchema)</code> |

## Custom Loader

Let's say we want to get $ref's from a MongoDB database, and our `$ref` objects in the JSON Schema might be something like:

```json
"foo": {
  "$ref":"mongodb:507c35dd8fada716c89d0013"
}
```

Our custom loader function passed in the `options` `loader` parameter would look something like:

```js
function myMongoDBLoader(ref, option, fn) {
  if(ref.indexOf('mongodb:') === 0) {
    var id = ref.substring(8);
    return collection.findOne({_id:id}, fn);
  }

  // not ours, pass back nothing to keep it the same
  // or pass error and use failOnMissing to abort
  return fn();
}
```
