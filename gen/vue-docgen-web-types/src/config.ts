import * as path from "path";
import * as fs from "fs";
import {WebTypesBuilderConfig} from "../types/config";

export function extractConfig(cwd: string,
                              watch: boolean = false,
                              configFileFromCmd?: string,
                              pathArray: string[] = []): WebTypesBuilderConfig {
    const configFilePath = configFileFromCmd
        ? path.resolve(cwd, configFileFromCmd)
        : path.join(cwd, 'web-types.config.js')
    const [componentsFromCmd, outFileFromCmd] = pathArray

    const packageJson = require(path.join(cwd, 'package.json')) || {}

    return {
        cwd,
        watch,
        componentsRoot: configFilePath ? path.dirname(configFilePath) : cwd,
        components: componentsFromCmd || 'src/components/**/[a-zA-Z]*.vue',
        outFile: outFileFromCmd || packageJson["web-types"] || './web-types.json',
        packageName: packageJson["name"],
        packageVersion: packageJson["version"],
        typesSyntax: "typescript",
        descriptionMarkup: "markdown",
        ...(fs.existsSync(configFilePath) ? require(configFilePath) : undefined)
    }

}