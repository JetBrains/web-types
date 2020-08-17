import {DocGenOptions} from "vue-docgen-api";
import {Html} from "./web-types";

export interface WebTypesBuilderConfig {
    /**
     * Current working directory
     */
    cwd: string,

    /**
     * Whether to keep builder process alive and rebuild web-types on changes.
     *
     * @default false
     */
    watch: boolean,

    /**
     * Root dir for resolving components patterns.
     *
     * @default parent of config file, or current working directory
     */
    componentsRoot: string,

    /**
     * Glob or globs matching component file names.
     *
     * @default "src/components/**\/[a-zA-Z]*.vue"
     */
    components: string | string[],

    /**
     * Name of output file for web-types, defaults to "web-types" property from "package.json" and if absent to "./web-types.json"
     */
    outFile: string,

    /**
     * Package name to be included in web-types.
     *
     * @default `name` property from `package.json`
     */
    packageName: string,

    /**
     * Package version to be included in web-types.
     *
     * @default `version` property from `package.json`
     */
    packageVersion: string,

    /**
     * Markup used in descriptions.
     *
     * @type "html" | "markdown" | "none" | undefined
     * @default "markdown"
     */
    descriptionMarkup?: Html['description-markup'],

    /**
     * Types syntax used in JSDoc.
     *
     * @type "typescript" | undefined
     * @default "typescript"
     */
    typesSyntax?: Html['types-syntax'],

    /**
     * Allows you to pass [vue-docgen-api](https://vue-styleguidist.github.io/docs/Docgen.html) some config.
     * Most notably, you can specify whether your components contain JSX code and the alias configured in your webpack.
     */
    apiOptions?: DocGenOptions,
}