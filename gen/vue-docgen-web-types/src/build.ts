import {WebTypesBuilderConfig} from "../types/config";
import * as path from "path";
import glob from 'globby';
import * as chokidar from 'chokidar';
import {FSWatcher} from 'chokidar';
import {parse} from 'vue-docgen-api'
import {HtmlAttribute, HtmlTag, HtmlVueFilter, JSONSchemaForWebTypes} from "../types/web-types";
import * as fs from "fs";
import mkdirp from 'mkdirp'

interface FileContents {
    tags?: HtmlTag[];
    attributes?: HtmlAttribute[];
    "vue-filters"?: HtmlVueFilter[];
}

export default async function build(config: WebTypesBuilderConfig) {

    config.componentsRoot = path.resolve(config.cwd, config.componentsRoot)
    config.outFile = path.resolve(config.cwd, config.outFile)

    // then create the watcher if necessary
    const {watcher, componentFiles} = await getSources(
        config.components,
        config.componentsRoot
    )

    console.log("Building web-types to " + config.outFile)

    const buildWebTypesBound = rebuild.bind(null, config, componentFiles, {}, watcher)
    try {
        await buildWebTypesBound()
    } catch (e) {
        console.error("Error building web-types: " + e.message)
        await watcher.close()
        return
    }
    if (config.watch) {
        watcher.on('add', buildWebTypesBound).on('change', buildWebTypesBound)
    }
    else {
        await watcher.close()
    }
}

async function getSources(
    components: string | string[],
    cwd: string,
): Promise<{
    watcher: chokidar.FSWatcher
    componentFiles: string[]
}> {
    const watcher = chokidar.watch(components, {cwd})

    const allComponentFiles = await glob(components, {cwd})

    return {watcher, componentFiles: allComponentFiles}
}

async function rebuild(
    config: WebTypesBuilderConfig,
    files: string[],
    cachedContent: { [filepath: string]: FileContents },
    watcher: FSWatcher,
    changedFilePath?: string) {

    const cacheWebTypesContent = async (filePath: string) => {
        cachedContent[filePath] = await extractInformation(
            path.join(config.componentsRoot, filePath),
            config
        )
        return true
    }

    if (changedFilePath) {
        console.log("Rebuilding on update file " + changedFilePath)
        try {
            // if in chokidar mode (watch), the path of the file that was just changed
            // is passed as an argument. We only affect the changed file and avoid re-parsing the rest
            await cacheWebTypesContent(changedFilePath)
        } catch (e) {
            throw new Error(
                `Error building file ${config.outFile} when file ${changedFilePath} has changed: ${e.message}`
            )
        }
    } else {
        try {
            // if we are initializing the current file, parse all components
            await Promise.all(files.map(cacheWebTypesContent))
        } catch (e) {
            throw new Error(`Error building file ${config.outFile}: ${e.message}`)
        }
    }
    // and finally save all concatenated values to the markdown file
    await writeDownWebTypesFile(config, Object.values(cachedContent), config.outFile)
}

async function writeDownWebTypesFile(config: WebTypesBuilderConfig, definitions: FileContents[], destFilePath: string) {
    const destFolder = path.dirname(destFilePath)
    await mkdirp(destFolder)
    let writeStream = fs.createWriteStream(destFilePath)
    const contents: JSONSchemaForWebTypes = {
        framework: "vue",
        name: config.packageName,
        version: config.packageVersion,
        contributions: {
            html: {
                "description-markup": config.descriptionMarkup,
                "types-syntax": config.typesSyntax,
                tags: definitions?.map(d => d.tags)?.reduce(flatten)?.sort(sorter),
                attributes: definitions?.map(d => d.attributes)?.reduce(flatten)?.sort(sorter),
                "vue-filters": definitions?.map(d => d["vue-filters"])?.reduce(flatten)?.sort(sorter),
            }
        }
    }

    const html = contents.contributions.html!
    if (html.tags?.length == 0) html.tags = undefined
    if (html.attributes?.length == 0) html.attributes = undefined
    if (html["vue-filters"]?.length == 0) html["vue-filters"] = undefined

    writeStream.write(JSON.stringify(contents, null, 2))

    // close the stream
    writeStream.close()
}

function flatten<T>(prev: T[], cur: T[]) {
    if (!cur) {
        return prev
    }
    const res = (prev || [])
    res.push(...cur)
    return res
}

function sorter(a: {name: string}, b: {name: string}): number {
    return a.name .localeCompare(b.name)
}

function ensureRelative(path: string) {
    return path.startsWith("./") || path.startsWith("../") ? path : "./" + path;
}

async function extractInformation(
    absolutePath: string,
    config: WebTypesBuilderConfig,
): Promise<FileContents> {
    const doc = await parse(absolutePath, config.apiOptions)
    return {
        tags: [
            {
                name: doc.displayName,
                description: doc.description,
                attributes: doc.props?.map(prop => ({
                    name: prop.name,
                    required: prop.required,
                    description: prop.description,
                    value: {
                        kind: "expression",
                        type: prop.type?.name ?? "any"
                    },
                    default: prop.defaultValue?.value,
                })),
                events: doc.events?.map(event => ({
                    name: event.name,
                    description: event.description
                })),
                slots: doc.slots?.map(slot => ({
                    name: slot.name,
                    description: slot.description
                })),
                source: {
                    module: ensureRelative(path.relative(config.cwd, absolutePath)),
                    symbol: doc.exportName
                }
            }
        ]
    }
}