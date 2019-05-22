import * as fs from "fs";
import * as path from "path";
import "streamjs";
import * as ts from "typescript";
import {
    CallExpression,
    ElementAccessExpression,
    LanguageServiceHost,
    NumericLiteral,
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

interface IStaticEntityAnalysis {
    slots: string[];
    events: string[];
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
            result.push({
                "name": key,
                "source-file": staticComponentDef && staticComponentDef.fileName,
                "attributes": createComponentAttributes(component),
                "events": stream.from(staticDefs)
                    .flatMap((obj) => obj!.events)
                    .distinct()
                    .toList(),
                "slots": stream.from(staticDefs)
                    .flatMap((obj) => obj!.slots)
                    .distinct()
                    .toList()
            });
        }
    }
    return result;
}

function createComponentAttributes(component: any) {
    const props = component.props;
    const result: any[] = [];
    for (const propName in props) {
        if (props.hasOwnProperty(propName)) {
            const prop = props[propName];
            result.push({
                name: propName,
                type: prop.type !== null ? prop.type : undefined,
                default: prop.default
            });
        }
    }
    return result;
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
            ids.set(id, analyseEntity(obj));
            return;
        }
    }
    ts.forEachChild(node, gatherStaticInformation);
}

function analyseEntity(entity: ts.ObjectLiteralExpression): IStaticEntityAnalysis {
    const slots: string[] = [];
    const events: string[] = [];
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
            const accessedName = getAccessedName(accessExpression);
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
        let eventName = "#<unresolved>";
        if (node.kind === SyntaxKind.CallExpression) {
            const callExpr = node as CallExpression;
            const firstArg = callExpr.arguments.find(() => true);
            if (firstArg && firstArg.kind === SyntaxKind.StringLiteral) {
                eventName = (firstArg as StringLiteral).text;
            }
        }
        events.push(eventName);
    }
}

function getPropertyName(prop: ts.ObjectLiteralElementLike) {
    return prop.name && prop.name.kind !== SyntaxKind.ComputedPropertyName ? prop.name.text : undefined;
}

function getParentOfKind(node: ts.Node, kind: SyntaxKind) {
    let result = node.parent;
    while (result && result.kind !== kind) {
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

function getAccessedName(accessExpression: ElementAccessExpression | PropertyAccessExpression | null) {
    if (accessExpression) {
        if (accessExpression.kind === SyntaxKind.PropertyAccessExpression) {
            return (accessExpression as PropertyAccessExpression).name.text;
        }
        const arg = (accessExpression as ElementAccessExpression).argumentExpression;
        if (arg.kind === SyntaxKind.StringLiteral) {
            return (arg as StringLiteral).text;
        }
    }
    return "#<unresolved>";
}
