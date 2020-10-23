createBrowserPolyfills();

let Vue = require("vue");
Vue = Vue.default || Vue;

const packageName = "$$PACKAGE$$";

if (packageName !== "vue") {
    Vue.options.components = {};
    Vue.options.filters = {};
    Vue.options.directives = {};
}


global.Vue = Vue;

// Do not register `window` global to avoid component
// registration side-effects in quasar framework
if (packageName !== "quasar-framework" && packageName !== "quasar") {
    global.window = {
        navigator,
        document,
        Vue,
        addEventListener() {
        },
        removeEventListener() {
        }
    };
}

if (packageName !== "vue") {
    let pkg = require("$$PACKAGE$$");

    if (pkg.default && !pkg.install) {
        pkg = pkg.default
    }

    if (Object.getOwnPropertyNames(Vue.options.components).length === 0) {
        Vue.use(pkg);
    }
}

const typesMapping = {
    String: "string",
    Number: "number",
    Boolean: "boolean",
    Function: "(...args: any[]) => any",
    Array: "any[]",
    Object: "object",
    Date: "Date",
    RegExp: "RegExp"
};

let result = {};
for (let type of ['components', 'directives', 'filters']) {
    let obj = Vue.options[type];
    result[type] = {};
    while (obj) {
        for (let key of Object.getOwnPropertyNames(obj)) {
            result[type][key] = copyOptions(obj[key]);
        }
        obj = Object.getPrototypeOf(obj);
    }
}

console.log(JSON.stringify(result, null, 2));

function copyOptions(obj, visited) {
    if ((visited || (visited = new Set())).has(obj)) return;
    visited.add(obj);
    try {
        if (obj === undefined || obj === null) {
            return undefined;
        }
        if (Array.isArray(obj)) {
            let result = [];
            for (let i in obj) {
                // noinspection JSUnfilteredForInLoop
                result[i] = copyOptions(obj[i])
            }
            return result;
        }
        if (typeof obj === "function") {
            if (obj.options) {
                return copyOptionsInner(obj.options, visited);
            }
        } else if (typeof obj === "object") {
            return copyOptionsInner(obj, visited);
        }
        return obj;
    } finally {
        visited.delete(obj)
    }
}

function copyOptionsInner(options) {
    let result = {};
    result["props"] = copyProps(options["props"]);
    result["name"] = options["name"];
    result["model"] = options["model"];
    for (let key of Object.getOwnPropertyNames(options)) {
        if (key.startsWith("___$args")) {
            result[key] = copyArgs(options[key], true);
        }
    }
    for (let key of Object.getOwnPropertyNames(options)) {
        if (key.startsWith("___$id")) {
            result[key] = options[key];
        }
    }
    return result;
}

function copyArgs(args, firstCall) {
    if (args === null || args === undefined) {
        return;
    }
    if (firstCall) {
        let result = [];
        for (let i = 0; i < args.length; i++) {
            result.push(copyArgs(args[i]));
        }
        while (result.length > 0 && result[result.length - 1] == null) {
            result.pop();
        }
        return result;
    }
    if (Array.isArray(args)) {
        let result = [];
        for (let arg of args) {
            result.push(copyArgs(arg));
        }
        return result;
    } else if (typeof args === "string" || typeof args === "number") {
        return args;
    }
    return null;
}

function copyProps(obj) {
    if (!obj) {
        return;
    }
    let result = {};
    for (let name of Object.getOwnPropertyNames(obj)) {
        if (name.startsWith("___$")) {
            continue;
        }
        let prop = obj[name];
        let data = {};
        if (typeof prop === "object" || typeof prop === "function") {
            for (let key of Object.getOwnPropertyNames(prop)) {
                let value = prop[key];
                if (key === "default") {
                    let isFunction = typeof value === "function"
                    if (isFunction) {
                        try {
                            if(isFactoryFunctionForEmptyDefaultValue(value)) {
                                isFunction = false
                                value = value()
                            } else {
                                value = getReadableDefaultFunction(value)
                            }
                        } catch (e) {
                            value = undefined;
                        }
                    }
                    if (value === null
                        || value === undefined
                        || (typeof value.match === "function"
                            // discard GUID name from quasar framework
                            && (value.match(/[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/)
                                // and date from vuetify framework
                                || value.match(/[0-9]+-[0-9]+-[0-9]+/)))) {
                        value = undefined;
                    } else if(!isFunction) {
                        value = JSON.stringify(value);
                    }
                }
                data[key] = convertValue(value)
            }
        } else {
            data["type"] = convertValue(prop);
        }
        result[name] = data;
    }
    return result;
}

function convertValue(value) {
    if (Array.isArray(value)) {
        let result = [];
        for (let i in value) {
            // noinspection JSUnfilteredForInLoop
            result[i] = convertValue(value[i])
        }
        return result;
    }
    if (typeof value === "function") {
        for (let type of [String, Number, Boolean, Function, Array, Object, Date, RegExp]) {
            if (value === type) {
                return typesMapping[type.name];
            }
        }
    }
    return value;
}

function createBrowserPolyfills() {
    // noinspection JSUnusedGlobalSymbols
    const element = {
        setAttribute: function () {
        },
        appendChild: function () {
        }
    };
    const textNode = {};
    // noinspection JSUnusedGlobalSymbols
    const style = {
        getPropertyValue: function () {
        }
    };
    global.navigator = {
        userAgent: "fake"
    };
    // noinspection JSUnusedGlobalSymbols
    global.document = {
        location: {
            href: ""
        },
        addEventListener() {
        },
        removeEventListener() {
        },
        documentElement: element,
        querySelector: function () {
        },
        getElementsByTagName: function () {
            return [element]
        },
        createElement: function () {
            return element
        },
        createTextNode: function () {
            return textNode
        },
        body: {
            classList: {
                add: function () {
                }
            },
            addEventListener() {
            },
            removeEventListener() {
            },
        }
    };
    global.XMLHttpRequest = {
        prototype: {
            send() {
            }
        }
    };
    global.Event = function () {
    };
    global.Element = {
        prototype: {}
    };
    global.CharacterData = {
        prototype: {}
    };
    global.DocumentType = {
        prototype: {}
    };
    global.getComputedStyle = function () {
        return style
    }
}

function isFactoryFunctionForEmptyDefaultValue(func) {
    const returnValue = func()
    const isEmptyArray = (Array.isArray(returnValue) && returnValue.length === 0)
    const isEmptyObject = (typeof returnValue === "object" && Object.keys(returnValue).length === 0)
    return isEmptyArray || isEmptyObject
}

function getReadableDefaultFunction(func) {
    return func.toString()
        .replace(/\n/g, '')
        .replace(/ {2,}/g, ' ')
        .replace('function _default()', '() =>')
}
