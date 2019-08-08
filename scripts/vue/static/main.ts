import {evaluate, LogLevelKind} from "@wessberg/ts-evaluator";
import * as fs from "fs";
import cloneDeep from "lodash/cloneDeep";
import * as path from "path";
import "streamjs";
import * as ts from "typescript";
import {
    BinaryExpression,
    CallExpression,
    ElementAccessExpression,
    ExpressionStatement,
    FunctionLikeDeclarationBase,
    IfStatement,
    LanguageServiceHost,
    NumericLiteral,
    ParameterDeclaration,
    PropertyAccessExpression,
    PropertyAssignment,
    ScriptSnapshot,
    StringLiteral,
    SyntaxKind
} from "typescript";

// tslint:disable-next-line:no-var-requires
const stream: typeof Stream = require("streamjs");

const pkgSource = process.argv[2];
const dynamicScriptName = path.basename(pkgSource);
const workingDir = path.dirname(pkgSource);
process.chdir(workingDir);

const dynamicJsonData = fs.readFileSync(process.argv[3]);
const dynamicJson = JSON.parse(dynamicJsonData as any);

const library = process.argv[4];

const production = process.argv.find((a) => a === "--production");
if (!production) {
    console.error("  ** development mode - errors are added to the output **");
}

const servicesHost: LanguageServiceHost = {
    getScriptFileNames: () => [dynamicScriptName],
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
        if (!fs.existsSync(fileName)) {
            return undefined;
        }
        return ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => ({
        allowJs: true
    }),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory
};

// Create the language service files
const services = ts.createLanguageService(
    servicesHost,
    ts.createDocumentRegistry()
);

const sourceFile = services.getProgram()!.getSourceFile(dynamicScriptName);

const entities = stream.from(Object.values(dynamicJson))
    .flatMap((val) => Object.values(val as any) as any[])
    .toArray();

const ID_PREFIX = "___$id";
const ARGS_PREFIX = "___$args";
const FUNCTION_NODES: Set<SyntaxKind> = new Set<SyntaxKind>([
    SyntaxKind.MethodDeclaration,
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.Constructor,
    SyntaxKind.SetAccessor,
    SyntaxKind.GetAccessor,
    SyntaxKind.FunctionExpression,
    SyntaxKind.ArrowFunction
]);

interface IEntityArguments {
    [id: number]: any[];
}

type IArgumentBasedProvider = (args: IEntityArguments, id: number) => string[];

interface IStaticEntityAnalysis {
    slots: Array<string | IArgumentBasedProvider>;
    events: Array<string | IArgumentBasedProvider>;
    scopedSlots: Map<string | IArgumentBasedProvider, Set<string>>;
    fileName?: string;
}

interface IDynamicEntityAnalysis {
    props: any;
    name: string;
    model?: any;
}

const staticAnalysis: Map<number, IStaticEntityAnalysis> = new Map<number, IStaticEntityAnalysis>();
const dynamicAnalysis: Map<number, IDynamicEntityAnalysis> = new Map<number, IDynamicEntityAnalysis>();

const EMPTY = {slots: [], events: [], scopedSlots: new Map()};

stream.from(entities)
    .flatMap((val) => Object.keys(val as any))
    .filter((key) => key.startsWith(ID_PREFIX) && key !== ID_PREFIX)
    .map((key) => key.substr(ID_PREFIX.length))
    .map((id) => Number.parseInt(id, 10))
    .distinct()
    .forEach((id) => {
        staticAnalysis.set(id, EMPTY);
    });

entities.forEach((entity) => {
    if (entity[ID_PREFIX]) {
        dynamicAnalysis.set(entity[ID_PREFIX], entity);

        // workaround bug in evaluator for vuetify support
        if (!entity.model) {
            entity.model = {
                event: "input"
            };
        }
    }
});

gatherStaticInformation(sourceFile!);

const webTypes = {
    $schema: "../../schema/web-types.json",
    framework: "vue",
    name: process.env.LIBRARY_NAME,
    version: process.env.LIBRARY_VERSION,
    contributions: {
        html: {
            "types-syntax": "typescript",
            "tags": createTagsList(),
            "attributes": createGlobalAttributesList()
        }
    }
};

console.log(JSON.stringify(webTypes, null, 2));

function noError(name: string) {
    return !production || name.indexOf("#Error") < 0;
}

function createSourceConfiguration(name: string, moduleSourceFile: string | undefined) {
    name = toAssetName(name);
    switch (library) {
        case "vuetify":
            return {
                module: "vuetify/lib",
                symbol: name
            };
        case "quasar-framework":
            if (moduleSourceFile === undefined) {
                return undefined;
            }
            if (moduleSourceFile.indexOf("./node_modules/") !== 0) {
                throw new Error(`Error with ${name}: ${moduleSourceFile}`);
            }
            return {
                module: moduleSourceFile.slice("./node_modules/".length),
                symbol: "default"
            };
    }
    if (!require(library)[name]) {
        if (!require(library)["V" + name]) {
            return production
                ? undefined
                : {
                    symbol: `#Error: Cannot find symbol '${name}' in module '${library}'`
                };
        } else {
            name = "V" + name;
        }
    }
    return {
        symbol: name
    };
}

function createTagsList() {
    const result: any[] = [];
    for (const key in dynamicJson.components) {
        if (dynamicJson.components.hasOwnProperty(key)) {
            const component = dynamicJson.components[key];
            const staticComponentDef = staticAnalysis.get(Number.parseInt(component[ID_PREFIX], 10));
            const staticDefs = stream.from(Object.keys(component))
                .filter((id) => id.startsWith(ID_PREFIX) && id !== ID_PREFIX)
                .map((id) => id.substr(ID_PREFIX.length))
                .map((id) => Number.parseInt(id, 10))
                .map((id) => staticAnalysis.get(id))
                .filter((obj) => !!obj)
                .toList() as IStaticEntityAnalysis[];
            const resolveArguments = createArgumentsResolver(component);
            const source = createSourceConfiguration(key, staticComponentDef && staticComponentDef.fileName);
            result.push({
                "name": key,
                source,
                "attributes": undefinedIfEmpty(createComponentAttributes(component)),
                "events": undefinedIfEmpty(stream.from(staticDefs)
                    .flatMap((obj) => obj!.events)
                    .flatMap(resolveArguments)
                    .filter(noError)
                    .distinct()
                    .sorted()
                    .map((name) => ({name}))
                    .toList()),
                "slots": undefinedIfEmpty(stream.from(staticDefs)
                    .flatMap((obj) => obj!.slots)
                    .flatMap(resolveArguments)
                    .filter(noError)
                    .distinct()
                    .sorted()
                    .map((name) => ({name}))
                    .toList()),
                "vue-scoped-slots": undefinedIfEmpty(createScopedSlots(staticDefs, resolveArguments)),
                "vue-model": createVueModel(component.model)
            });
        }
    }
    sortNamedElements(result);
    return result;

    function createScopedSlots(staticDefs: IStaticEntityAnalysis[],
                               resolveArguments: (value: (string | IArgumentBasedProvider)) => (string[])) {
        const merged = new Map<string, Set<string>>();
        stream.from(staticDefs)
            .flatMap((obj) => Array.from(obj!.scopedSlots.entries()))
            .flatMap((entry) => resolveArguments(entry[0])
                .map((name) => [name, entry[1]] as [string, Set<string>]))
            .filter((entry) => noError(entry[0]) && Array.from(entry[1].values()).every(noError))
            .forEach((entry) => {
                let props = merged.get(entry[0]);
                if (props === undefined) {
                    props = new Set<string>();
                    merged.set(entry[0], props);
                }
                entry[1].forEach((e) => props!.add(e));
            });
        return Array.from(merged.entries())
            .map((entry) => ({
                name: entry[0],
                properties: entry[1].size === 0
                    ? undefined
                    : Array.from(entry[1]).map((prop) => ({
                        name: prop
                    }))
            }));
    }

    function createVueModel(model: any): any {
        model = model || {};
        const prop = typeof model.prop === "string" && model.prop !== "value" ? model.prop : undefined;
        const event = typeof model.event === "string" && model.event !== "input" ? model.event : undefined;
        return prop === undefined && event === undefined ? undefined : {prop, event};
    }

    function undefinedIfEmpty<T>(list: T[]): T[] | undefined {
        return list.length === 0 ? undefined : list;
    }
}

function createGlobalAttributesList() {
    const result: any[] = [];
    for (const key in dynamicJson.directives) {
        if (dynamicJson.directives.hasOwnProperty(key)) {
            const directive = dynamicJson.directives[key];
            const staticDirectiveDef = staticAnalysis.get(Number.parseInt(directive[ID_PREFIX], 10));
            result.push({
                name: "v-" + fromAssetName(key),
                source: createSourceConfiguration(key, staticDirectiveDef && staticDirectiveDef.fileName)
            });
        }
    }
    sortNamedElements(result);
    return result;
}

function createArgumentsResolver(component: any) {
    const args: IEntityArguments = {};
    stream.from(Object.keys(component))
        .filter((key) => key.startsWith(ARGS_PREFIX))
        .map((key) => Number.parseInt(key.substr(ARGS_PREFIX.length), 10))
        .forEach((id) => {
            args[id] = component[ARGS_PREFIX + id.toString(10)];
        });
    return (value: string | IArgumentBasedProvider) => {
        if (typeof value === "string") {
            return [value];
        } else {
            return value(args, component[ID_PREFIX]);
        }
    };
}

function outputBooleanTypeIfNeeded(type: any) {
    return !!(Array.isArray(type) ? type : [type])
        .find((t: any) => t === "boolean")
        ? "boolean" : undefined;
}

function createComponentAttributes(component: any) {
    const props = component.props;
    const result: any[] = [];
    for (const propName in props) {
        if (props.hasOwnProperty(propName)
            && !propName.startsWith("___$")
            && noError(propName)) {
            const prop = props[propName];
            result.push({
                name: propName,
                value: prop.type !== null && prop.type !== undefined ? {
                    kind: "expression",
                    type: prop.type
                } : undefined,
                type: outputBooleanTypeIfNeeded(prop.type),
                default: prop.default,
                required: prop.required ? true : undefined
            });
        }
    }
    sortNamedElements(result);
    return result;
}

function sortNamedElements(arr: any[]) {
    arr.sort((a, b) => (a.name > b.name) ? 1 : (a.name === b.name) ? 0 : -1);
}

function gatherStaticInformation(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        const obj = node as ts.ObjectLiteralExpression;
        const id = obj.properties
            .filter((prop) => prop.kind === SyntaxKind.PropertyAssignment
                && getPropertyName(prop) === `${ID_PREFIX}`)
            .map((prop) => (prop as ts.PropertyAssignment).initializer)
            .filter((expr) => expr.kind === SyntaxKind.NumericLiteral)
            .map((expr) => Number.parseInt((expr as NumericLiteral).text, 10))
            .shift();
        if (id && staticAnalysis.has(id)) {
            staticAnalysis.set(id, analyseEntity(obj, id));
            return;
        }
    }
    ts.forEachChild(node, gatherStaticInformation);
}

function analyseEntity(entity: ts.ObjectLiteralExpression, id: number): IStaticEntityAnalysis {
    const slots: Array<string | IArgumentBasedProvider> = [];
    const scopedSlots: Map<string | IArgumentBasedProvider, Set<string>> = new Map();
    const events: Array<string | IArgumentBasedProvider> = [];
    const enclosingFunctionCall = getParentOfKind(entity, FUNCTION_NODES);
    const typeChecker = services.getProgram()!.getTypeChecker();
    visitEntityCode(entity);
    return {
        events,
        slots,
        scopedSlots,
        fileName: discoverFileName()
    };

    function discoverFileName() {
        let prop = getParentOfKind(entity, SyntaxKind.PropertyAssignment);
        while (prop) {
            const name = getPropertyName(prop as PropertyAssignment);
            if (name && name.startsWith("./")) {
                return name;
            }
            prop = getParentOfKind(prop, SyntaxKind.PropertyAssignment);
        }
    }

    function visitEntityCode(node: ts.Node) {
        const accessExpression = toAccessExpression(node);
        if (accessExpression && accessExpression.expression.kind === SyntaxKind.ThisKeyword) {
            const accessedName = getAccessedName(accessExpression, true);
            if (accessedName === "$slots") {
                visitSlot(accessExpression.parent, false);
                return;
            } else if (accessedName === "$emit"
                || (library === "vuetify" && accessedName === "emitNodeCache")) {
                visitEventEmit(accessExpression.parent);
                return;
            } else if (library === "quasar" && accessedName === "__emit"
                && accessExpression.parent.kind === SyntaxKind.CallExpression
                && (accessExpression.parent as CallExpression).expression === accessExpression
                && (accessExpression.parent as CallExpression).arguments.find(() => true)) {
                visitEventEmit(accessExpression.parent);
            } else if (accessedName === "$scopedSlots") {
                visitSlot(accessExpression.parent, true);
                return;
            }
        }
        if (node.kind === SyntaxKind.Identifier
            && (node as ts.Identifier).text === "$slots") {
            visitSlot(node.parent, false);
        }

        ts.forEachChild(node, visitEntityCode);
    }

    function visitSlot(node: ts.Node, scoped: boolean) {
        if (node
            && node.kind !== SyntaxKind.VariableDeclaration
            && node.kind !== SyntaxKind.CallExpression) {
            const access = toAccessExpression(node);
            if (access) {
                if (access.expression.kind === SyntaxKind.Identifier
                    && (access.expression as ts.Identifier).text === (scoped ? "$scopedSlots" : "$slots")
                ) {
                    visitSlot(access.parent, scoped);
                } else {
                    const slotName = getAccessedName(access);
                    if (slotName === "$slots") {
                        return;
                    }
                    if (scoped) {
                        let props = scopedSlots.get(slotName);
                        if (!props) {
                            props = new Set();
                            scopedSlots.set(slotName, props);
                        }
                        gatherScopedSlotProps(access, props);
                    } else {
                        slots.push(slotName);
                    }
                }
            }
        }
    }

    function visitEventEmit(node: ts.Node) {
        let eventName: string | IArgumentBasedProvider | undefined;
        if (node.kind === SyntaxKind.CallExpression) {
            const callExpr = node as CallExpression;
            const firstArg = callExpr.arguments.find(() => true);
            if (firstArg) {
                eventName = getExpressionStringValue(firstArg);
                if (typeof eventName === "string" && eventName.startsWith("#Error:")) {
                    if (library === "vuetify") {
                        if (eventName.indexOf("this.$emit(\"click:\"") > 0) {
                            eventName = "click";
                        } else if (isWithinFunction(node, "emitNodeCache")) {
                            return;
                        }
                    } else if (library === "quasar") {
                        if (eventName.indexOf("this.$emit('validation-' + (res === true ? 'success' : 'error'") > 0) {
                            events.push("validation-success");
                            events.push("validation-error");
                            return;
                        }
                    }
                }
            }
        }
        events.push(eventName || "#Error: expression too complex: " + node.parent.getFullText().trim());
    }

    function gatherScopedSlotProps(accessExpression: ElementAccessExpression | PropertyAccessExpression,
                                   props: Set<string>) {
        if (accessExpression.parent.kind === SyntaxKind.CallExpression) {
            const callExpr = accessExpression.parent as CallExpression;
            if (callExpr.expression !== accessExpression) {
                return;
            }
            const firstArg = callExpr.arguments.find(() => true);
            if (firstArg) {
                if (firstArg.kind === SyntaxKind.ObjectLiteralExpression) {
                    gatherProps(firstArg as ts.ObjectLiteralExpression, props);
                    return;
                }
            }
        } else if (accessExpression.parent.kind === SyntaxKind.BinaryExpression) {
            const binaryExpression = accessExpression.parent as BinaryExpression;
            if (binaryExpression.operatorToken.kind !== SyntaxKind.EqualsToken) {
                return;
            }
        } else if (accessExpression.parent.kind === SyntaxKind.VariableDeclaration) {
            // Implement
        } else {
            return;
        }
        props.add("#Error: Unsupported scopedProp expression:" + accessExpression.parent.getFullText());
    }

    function gatherProps(objectLiteral: ts.ObjectLiteralExpression, props: Set<string>) {
        objectLiteral.properties.forEach((prop) => {
            if (prop.kind === SyntaxKind.PropertyAssignment) {
                if (prop.name.kind === SyntaxKind.Identifier) {
                    props.add(prop.name.text);
                } else {
                    props.add("#Error: Unsupported property name kind " + prop.kind + ": "
                        + objectLiteral.parent.getFullText());
                }
            } else {
                props.add("#Error: Unsupported property kind " + prop.kind + ": " + objectLiteral.parent.getFullText());
            }
        });
    }

    function isWithinFunction(node: ts.Node, name: string): boolean {
        while (node && (node.kind !== SyntaxKind.FunctionExpression
            || ((node as ts.FunctionExpression).name
                && (node as ts.FunctionExpression).name!.text === name))) {
            node = node.parent;
        }
        return !!node;
    }

    function getAccessedName(accessExpression: ElementAccessExpression | PropertyAccessExpression | null,
                             simple: boolean = false): IArgumentBasedProvider | string {
        if (accessExpression) {
            if (accessExpression.kind === SyntaxKind.PropertyAccessExpression) {
                return (accessExpression as PropertyAccessExpression).name.text;
            }
            return getExpressionStringValue((accessExpression as ElementAccessExpression).argumentExpression, simple);
        }
        return "#Error: no access expression";
    }

    function getExpressionStringValue(expression: ts.Expression,
                                      simple: boolean = false): string | IArgumentBasedProvider {
        if (expression.kind === SyntaxKind.StringLiteral
            || expression.kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
            return (expression as ts.StringLiteralLike).text;
        } else if (expression.kind === SyntaxKind.Identifier && !simple) {
            const symbol = typeChecker.getSymbolAtLocation(expression);
            if (symbol && (symbol.getDeclarations() || []).length === 1) {
                const decl = symbol.getDeclarations()![0];
                if (decl.kind === SyntaxKind.Parameter) {
                    const parent = decl.parent;
                    if (parent === enclosingFunctionCall && FUNCTION_NODES.has(decl.parent.kind)) {
                        const index = (decl.parent as ts.SignatureDeclaration)
                            .parameters.indexOf(decl as ParameterDeclaration);
                        if (index >= 0) {
                            const defaultValue = findDefaultValue(symbol, decl as ParameterDeclaration);
                            return (args) => {
                                return [(args[id] || [])[index] || defaultValue];
                            };
                        }
                    }
                }
            }
            return (args, actualId) => {
                const result = evaluateExpression(expression, actualId, args[id]);
                if (result.startsWith("#Error:")) {
                    if (library === "vuetify"
                        && isWithinFunction(expression, "getMouseEventHandlers")) {
                        return [];
                    } else if (library === "quasar") {
                        if (isWithinFunction(expression, "__emit")) {
                            return [];
                        }
                    }
                }
                return [result];
            };
        } else if (expression.kind === SyntaxKind.PropertyAccessExpression) {
            const propAccess = expression as PropertyAccessExpression;
            if (propAccess.expression.kind === SyntaxKind.ThisKeyword) {
                return (args, actualId) => {
                    const result = evaluateThisPropertyValue(propAccess.name.text, actualId);
                    if (result.startsWith("#Error:")) {
                        if (library === "quasar"
                            && result.indexOf("Unexpected Node: 'Parameter', while evaluating: showing") > 0) {
                            return ["left", "right"];
                        }
                    }
                    return [result];
                };
            }
        }
        return "#Error: expression too complex" + (simple ? "" : ": " + expression.parent.getFullText().trim());
    }

    function evaluateThisPropertyValue(name: string, actualId: number): string {
        const assignmentExpressions: ts.Expression[] = [];
        findAssignmentExpressions(entity);

        const values = assignmentExpressions
            .map((value) => evaluateExpression(value, actualId))
            .filter((value) => !!value);

        if (values.length > 1) {
            return `#Error: too many values for 'this.${name}': ${JSON.stringify(values)}`;
        } else if (values.length === 0) {
            return `#Error: value for 'this.${name}' not found`;
        }
        return values[0]!;

        function findAssignmentExpressions(node: ts.Node) {
            if (node.kind === SyntaxKind.BinaryExpression) {
                const expr = node as BinaryExpression;
                if (expr.operatorToken.kind === SyntaxKind.EqualsToken
                    && expr.left.kind === SyntaxKind.PropertyAccessExpression) {
                    const propAccess = expr.left as PropertyAccessExpression;
                    if (propAccess.expression.kind === SyntaxKind.ThisKeyword
                        && name === propAccess.name.text) {
                        assignmentExpressions.push(expr.right);
                        return;
                    }
                }
            }
            ts.forEachChild(node, findAssignmentExpressions);
        }
    }

    function evaluateExpression(expression: ts.Expression, actualId: number, args?: any[]): string {
        const result = evaluate({
            node: expression,
            typeChecker,
            environment: {
                extra: {
                    this: {
                        $options: cloneDeep(dynamicAnalysis.get(actualId))
                    },
                    arguments: args
                }
            },
            policy: {
                deterministic: true,
                io: {
                    read: false,
                    write: false
                }
            },
            logLevel: LogLevelKind.SILENT
        });
        if (result.success) {
            return (result.value as any).toString();
        }
        return "#Error: " + result.reason.name + ": " + result.reason.message
            + ", while evaluating: " + expression.getFullText().trim();
    }

    function findDefaultValue(symbol: ts.Symbol, parameter: ts.ParameterDeclaration) {
        const body = (parameter.parent as FunctionLikeDeclarationBase).body;
        return (body && ts.forEachChild(body, (node) => {
            let condition;
            let thenBlock;
            let conditionRight;
            let conditionLeft;
            if (node.kind === SyntaxKind.IfStatement
                && (condition = (node as IfStatement).expression)
                && (thenBlock = (node as IfStatement).thenStatement)
                && condition.kind === SyntaxKind.BinaryExpression
                && (condition as BinaryExpression).operatorToken.kind === SyntaxKind.EqualsEqualsEqualsToken
                && (conditionRight = (condition as BinaryExpression).right)
                && conditionRight.kind === SyntaxKind.VoidExpression
                && (conditionLeft = (condition as BinaryExpression).left)
                && typeChecker.getSymbolAtLocation(conditionLeft) === symbol) {
                return ts.forEachChild(thenBlock, (thenNode) => {
                    let expression;
                    let value;
                    if (thenNode.kind === SyntaxKind.ExpressionStatement
                        && (expression = (thenNode as ExpressionStatement).expression)
                        && expression.kind === SyntaxKind.BinaryExpression
                        && (expression as BinaryExpression).operatorToken.kind === SyntaxKind.EqualsToken
                        && typeChecker.getSymbolAtLocation((expression as BinaryExpression).left) === symbol
                        && (value = (expression as BinaryExpression).right)
                    ) {
                        if (value.kind === SyntaxKind.StringLiteral) {
                            return (value as StringLiteral).text;
                        } else {
                            return "#Error: expression for default value too complex: "
                                + value.parent.getFullText().trim();
                        }
                    }
                });
            }
        })) || "#Error: default value not located: " + parameter.name;
    }
}

function getPropertyName(prop: ts.ObjectLiteralElementLike) {
    return prop.name && prop.name.kind !== SyntaxKind.ComputedPropertyName ? prop.name.text : undefined;
}

function getParentOfKind(node: ts.Node, kind: SyntaxKind | Set<SyntaxKind>) {
    // noinspection SuspiciousTypeOfGuard
    const check = kind instanceof Set
        ? (k: SyntaxKind) => kind.has(k)
        : (k: SyntaxKind) => k === kind;
    let result = node.parent;
    while (result && !check(result.kind)) {
        result = result.parent;
    }
    return result;
}

function toAccessExpression(node: ts.Node) {
    if (node.kind === SyntaxKind.PropertyAccessExpression
        || node.kind === SyntaxKind.ElementAccessExpression) {
        return node as ElementAccessExpression | PropertyAccessExpression;
    }
    return null;
}

function fromAssetName(text: string): string {
    return text.split(/(?=[A-Z])/)
        .filter((s) => s !== "")
        .map((s) => s.toLowerCase())
        .join("-");
}

function toAssetName(text: string): string {
    return text.split(/-/)
        .filter((s) => s !== "")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");
}
