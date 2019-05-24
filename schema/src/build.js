const $RefParser = require('json-schema-ref-parser');
const mergeAllOf = require('json-schema-merge-allof');
const schema = require('./web-types.schema.json');

$RefParser.dereference(schema, function(err, schema) {
    if (err) {
        console.error(err);
        process.exit(1)
    }
    else {
        schema = mergeAllOf(schema);
        delete schema["definitions"];
        console.log(JSON.stringify(schema, null, 2));
    }
});
