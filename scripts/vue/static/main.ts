import * as fs from "fs";
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

const staticJsonData = fs.readFileSync(process.argv[3]);
const staticJson = JSON.parse(staticJsonData as any);

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

const entities = stream.from(Object.values(staticJson))
    .flatMap(Object.values)
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

type IArgumentBasedProvider = (args: IEntityArguments) => string[];

interface IStaticEntityAnalysis {
    slots: Array<string | IArgumentBasedProvider>;
    events: Array<string | IArgumentBasedProvider>;
    fileName?: string;
}

const ids: Map<number, IStaticEntityAnalysis> = new Map<number, IStaticEntityAnalysis>();

const EMPTY = {slots: [], events: []};

stream.from(entities)
    .flatMap(Object.keys)
    .filter((key) => key.startsWith(ID_PREFIX) && key !== ID_PREFIX)
    .map((key) => key.substr(ID_PREFIX.length))
    .map((id) => Number.parseInt(id, 10))
    .distinct()
    .forEach((id) => {
        ids.set(id, EMPTY);
    });

gatherStaticInformation(sourceFile!);

const webTypes = {
    framework: "vue",
    name: process.env.LIBRARY_NAME,
    version: process.env.LIBRARY_VERSION,
    contributions: {
        html: {
            "types-syntax": "typescript",
            "tags": createTagsList()
        }
    }
};

console.log(JSON.stringify(webTypes, null, 2));

function createTagsList() {
    const result: any[] = [];
    for (const key in staticJson.components) {
        if (staticJson.components.hasOwnProperty(key)) {
            const component = staticJson.components[key];
            const staticComponentDef = ids.get(Number.parseInt(component[ID_PREFIX], 10));
            const staticDefs = stream.from(Object.keys(component))
                .filter((id) => id.startsWith(ID_PREFIX) && id !== ID_PREFIX)
                .map((id) => id.substr(ID_PREFIX.length))
                .map((id) => Number.parseInt(id, 10))
                .map((id) => ids.get(id))
                .filter((obj) => obj)
                .toList();
            const resolveArguments = createArgumentsResolver(component);
            result.push({
                "name": key,
                "source-file": staticComponentDef && staticComponentDef.fileName,
                "attributes": createComponentAttributes(component),
                "events": stream.from(staticDefs)
                    .flatMap((obj) => obj!.events)
                    .flatMap(resolveArguments)
                    .distinct()
                    .sorted()
                    .toList(),
                "slots": stream.from(staticDefs)
                    .flatMap((obj) => obj!.slots)
                    .flatMap(resolveArguments)
                    .distinct()
                    .sorted()
                    .toList()
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
            return value(args);
        }
    };
}

function createComponentAttributes(component: any) {
    const props = component.props;
    const result: any[] = [];
    for (const propName in props) {
        if (props.hasOwnProperty(propName) && !propName.startsWith("___$")) {
            const prop = props[propName];
            result.push({
                name: propName,
                type: prop.type !== null ? prop.type : undefined,
                default: prop.default
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
        if (id && ids.has(id)) {
            ids.set(id, analyseEntity(obj, id));
            return;
        }
    }
    ts.forEachChild(node, gatherStaticInformation);
}

function analyseEntity(entity: ts.ObjectLiteralExpression, id: number): IStaticEntityAnalysis {
    const slots: Array<string | IArgumentBasedProvider> = [];
    const events: Array<string | IArgumentBasedProvider> = [];
    const enclosingFunctionCall = getParentOfKind(entity, FUNCTION_NODES);
    const typeChecker = services.getProgram()!.getTypeChecker();
    visitEntityCode(entity);
    return {
        events,
        slots,
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
                visitSlot(accessExpression.parent);
                return;
            } else if (accessedName === "$emit") {
                visitEventEmit(accessExpression.parent);
                return;
            }
        }

        ts.forEachChild(node, visitEntityCode);
    }

    function visitSlot(node: ts.Node) {
        slots.push(getAccessedName(toAccessExpression(node)));
    }

    function visitEventEmit(node: ts.Node) {
        let eventName: string | IArgumentBasedProvider = "#<unresolved>";
        if (node.kind === SyntaxKind.CallExpression) {
            const callExpr = node as CallExpression;
            const firstArg = callExpr.arguments.find(() => true);
            if (firstArg) {
                eventName = resolveExpression(firstArg);
            }
        }
        events.push(eventName);
    }

    function getAccessedName(accessExpression: ElementAccessExpression | PropertyAccessExpression | null,
                             simple: boolean = false): IArgumentBasedProvider | string {
        if (accessExpression) {
            if (accessExpression.kind === SyntaxKind.PropertyAccessExpression) {
                return (accessExpression as PropertyAccessExpression).name.text;
            }
            return resolveExpression((accessExpression as ElementAccessExpression).argumentExpression, simple);
        }
        return "#<unresolved>";
    }

    function resolveExpression(expression: ts.Expression, simple: boolean = false): string | IArgumentBasedProvider {
        if (expression.kind === SyntaxKind.StringLiteral) {
            return (expression as StringLiteral).text;
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
        }
        return "#Error: expression too complex: " + (simple ? "" : ": " + expression.getFullText());
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
                            return "#Error: expression for default value too complex: " + value.getFullText();
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
