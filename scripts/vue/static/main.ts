import * as ts from "typescript"
import {LanguageServiceHost, NumericLiteral, PropertyAssignment, ScriptSnapshot, SyntaxKind} from "typescript"
import * as fs from "fs";
import * as path from "path";
import "streamjs";

let stream: typeof Stream = require("streamjs");

const pkgSource = process.argv[2];
const dynamicScriptName = path.basename(pkgSource);
const workingDir = path.dirname(pkgSource);
process.chdir(workingDir);

const staticJsonData = fs.readFileSync(process.argv[3]);
const staticJson = JSON.parse(staticJsonData as any);

const servicesHost: LanguageServiceHost = {
    getScriptFileNames: () => [dynamicScriptName],
    getScriptVersion: () => "1",
    getScriptSnapshot: fileName => {
        if (!fs.existsSync(fileName)) {
            return undefined;
        }
        return ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => ({
        allowJs: true
    }),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory
};

// Create the language service files
const services = ts.createLanguageService(
    servicesHost,
    ts.createDocumentRegistry()
);

let sourceFile = services.getProgram()!.getSourceFile(dynamicScriptName);

let entities = stream.from(Object.values(staticJson))
    .flatMap(Object.values)
    .toArray();

const ID_PREFIX = "___$id";

let ids : Map<number, any> = new Map<number,any>();

const EMPTY = {};

stream.from(entities)
    .flatMap(Object.keys)
    .filter(key => key.startsWith(ID_PREFIX) && key !== ID_PREFIX)
    .map(key => key.substr(ID_PREFIX.length))
    .map(id => Number.parseInt(id))
    .distinct()
    .forEach(id => {
        ids.set(id, EMPTY);
    });

gatherStaticInformation(sourceFile!);

let ents: any = {};
ids.forEach((val, key) => val !== EMPTY ? ents[key] = val : null);
console.log(JSON.stringify(ents, null, 2));

function gatherStaticInformation(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        let obj = node as ts.ObjectLiteralExpression;
        let id = obj.properties
            .filter(prop => prop.kind === SyntaxKind.PropertyAssignment
                && getPropertyName(prop) === `${ID_PREFIX}`)
            .map(prop => (prop as ts.PropertyAssignment).initializer)
            .filter(expr => expr.kind === SyntaxKind.NumericLiteral)
            .map(expr => Number.parseInt((expr as NumericLiteral).text))
            .shift();
        if (id && ids.has(id)) {
            ids.set(id, analyseEntity(obj));
            return;
        }
    }
    ts.forEachChild(node, gatherStaticInformation);
}

function analyseEntity(entity: ts.ObjectLiteralExpression) {
    return {
        fileName: discoverFileName()
    };

    function discoverFileName() {
        let prop = getParentOfKind(entity, SyntaxKind.PropertyAssignment);
        while (prop) {
            let name = getPropertyName(prop as PropertyAssignment);
            if (name && name.startsWith("./")) {
                return name;
            }
            prop = getParentOfKind(prop, SyntaxKind.PropertyAssignment);
        }
    }
}

function getPropertyName(prop: ts.ObjectLiteralElementLike) {
    return prop.name && prop.name.kind !== SyntaxKind.ComputedPropertyName ? prop.name.text : undefined;
}

function getParentOfKind(node: ts.Node, kind: SyntaxKind) {
    let result = node.parent;
    while (result  && result.kind !== kind) {
        result = result.parent
    }
    return result;
}
