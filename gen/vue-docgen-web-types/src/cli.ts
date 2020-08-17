#!/usr/bin/env node
import minimist from 'minimist'
import {extractConfig} from "./config";
import build from "./build";

const { _: pathArray, configFile, watch, cwd } = minimist(process.argv.slice(2), {
    alias: { c: 'configFile', w: 'watch' }
})

const conf = extractConfig(cwd || process.cwd(), watch, configFile, pathArray)
build(conf)