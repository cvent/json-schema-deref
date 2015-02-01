# json-schema-deref

Dereference JSON pointers in a JSON schemas with their true resolved values.

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
```

This utility lets you do that:


```js
var deref = require('json-schema-deref');
var myschema = require('schema.json');

defer(myschema, function(err, fullSchema) {
  console.dir(fullSchema); // has the full expanded $refs
};
```

## API

### defer(schema, options, fn)

Derefs `$ref`'s in json schema to actual resolved values. Supports local, file and web refs.

Parameters:

#### `schema`
The input JSON schema

#### `options`

`baseFolder` - the base folder to get relative path files from. Default is `process.cwd()`

`cache` - whether to cache the result from the request. true if to cache, false otherwise.

`cacheTTL` - the time to keep request result in cache. Default is 5 minutes.

`loader` - a function for custom loader. Invoked if we could not resolve the ref type, or if there was an error resolving a web or file ref types.
           function with signature: `function(refValue, options, fn)`

  - `refValue` - the string value of the ref being resolved. Ex: `db://my_database_id`
  - `options` - options parameter passed to `deref`
  - `fn` - The final callback function, in form `function(err, newValue)`
    * `err` - error if ref is valid for the loader but there was an error resolving the ref
    * `newValue` - the resolved ref value, or null/undefined if the ref isn't for this custom loader and we should just leave the $ref as is.

#### fn
The final callback `function(err, fullSchema)`.

## Custom Loader

Let's say we want to get $ref's from a MongoDB database. And our ref objects in the JSON Schema might be something like:

```json
"foo": {
  "$ref":"mongodb:507c35dd8fada716c89d0013"
}
```

Our custom loader function passed in `options` would look something like:

```js
function myMongoDBLoader(ref, option, fn) {
  if(ref.indexOf('mongodb:') === 0) {
    var id = ref.substring(8);
    collection.findOne({_id:id},function(fn));
  }

  // not our, keep it the same
  return fn(null);
}
```