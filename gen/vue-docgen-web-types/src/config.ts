import * as path from "path";
import * as fs from "fs";
import {DocGenOptions} from "vue-docgen-api";
import {Html} from "../types/web-types";

export interface WebTypesDocgenConfig {
    cwd: string,
    watch: boolean,
    componentsRoot: string,
    components: string,
    outFile: string,
    /**
     * Allows you to pass [vue-docgen-api](https://vue-styleguidist.github.io/docs/Docgen.html) some config.
     * Most notably, you can specify whether your components contain JSX code and the alias configured in your webpack.
     */
    apiOptions?: DocGenOptions,

    packageName: string,
    packageVersion: string,
    descriptionMarkup?: Html['description-markup'],
    typesSyntax?: Html['types-syntax'],
}

export function extractConfig(cwd: string,
                              watch: boolean = false,
                              configFileFromCmd?: string,
                              pathArray: string[] = []): WebTypesDocgenConfig {
    const configFilePath = configFileFromCmd
        ? path.resolve(cwd, configFileFromCmd)
        : path.join(cwd, 'web-types.config.js')
    const [componentsFromCmd, outFileFromCmd] = pathArray

    const packageJson = require(path.join(cwd, 'package.json')) || {}

    return {
        cwd,
        watch,
        componentsRoot: path.dirname(configFilePath),
        components: componentsFromCmd || 'src/components/**/[a-zA-Z]*.vue',
        outFile: outFileFromCmd || packageJson["web-types"] || './web-types.json',
        packageName: packageJson["name"],
        packageVersion: packageJson["version"],
        typesSyntax: "typescript",
        descriptionMarkup: "markdown",
        ...(fs.existsSync(configFilePath) ? require(configFilePath) : undefined)
    }

}