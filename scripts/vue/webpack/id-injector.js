let recast = require("recast");
let id = 0;
let interestingFields = new Set();
["name", "unbind", "methods", "computed"].forEach(el => interestingFields.add(el));
module.exports = function (source) {
    let ast = recast.parse(source, {
        parser: require('recast/parsers/typescript')
    });
    recast.visit(ast, {
        visitObjectExpression: function (path) {
            let obj = path.node;
            if (obj.properties.find(prop => prop.key && interestingFields.has(prop.key.name))) {
                let curId = id++;
                obj.properties.push({
                    type: "ObjectProperty",
                    shorthand: false,
                    key: {
                        type: "StringLiteral",
                        value: "___$id"
                    },
                    value: {
                        type: "Literal",
                        value: curId
                    },
                    accessibility: null,
                    computed: null
                });
                obj.properties.push({
                    type: "ObjectProperty",
                    shorthand: false,
                    key: {
                        type: "StringLiteral",
                        value: "___$id" + curId
                    },
                    value: {
                        type: "Literal",
                        value: 0
                    },
                    accessibility: null,
                    computed: null
                });
                obj.properties.push({
                    type: "ObjectProperty",
                    shorthand: false,
                    key: {
                        type: "StringLiteral",
                        value: "___$args" + curId
                    },
                    value: {
                        type: "Identifier",
                        name: "arguments"
                    },
                    accessibility: null,
                    computed: null
                });
            }
            this.traverse(path)
        }
    });
    return recast.print(ast).code;
};
