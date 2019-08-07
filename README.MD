[![GitHub license](https://img.shields.io/badge/license-Apache%20License%202.0-blue.svg?style=flat)](https://www.apache.org/licenses/LICENSE-2.0)

# Web-types

Welcome to web-types, the JSON standard to make web component libraries IDE friendly. 

Web-types is a framework agnostic standard to provide IDE with metadata information about contents 
of a web components library. It also provides extensions for a framework specific content.

# Distribution

Library providers are welcome to include detailed web-types JSONs and link them through `web-types`
property in `package.json`. 

For the most popular libraries basic information is published under `@web-types` scope on NPM. 
Currently following frameworks and libraries are supported in such a way:
 * Vue.js
    * bootstrap-vue 
    * quasar
    * quasar-framework
    * vuetify 

Published JSONs are checked into repository under `packages` folder. In case of web-types published to `@web-types` scope,  IDEs are supposed to download required JSONs without any changes to user project structure.

Various IDEs perform optimizations when scanning `node_modules` directory, so to ensure that `web-types` for 
your package are always available, make sure it's listed in `pacakges/registry.json`.

# Schema

Web-types schema is available in `schema` folder.

# Generating web-types

You can use `scripts/extract.sh` bash script to extract metadata information from a library. 
So far only vue.js framework extraction is supported. The usage syntax for the script is following:

```
extract.sh vue <package-name> <sem-version-range> [--production,--discard-same]
```
Example usage:
```
extract.sh vue vuetify ">=1.0.0" --production --discard-same
```
The script will output "#Error:..." strings into JSON in case of syntax it doesn't understand
while performing static analysis. This allows to improve script to handle specific syntax used
by a library. However, while publishing metadata we don't want to include errors, so one can
use `--production` parameter to exclude errors from the output. 

Some versions of libraries contain exactly the same information and with `--discard-same` parameter
we can minimize amount of generated JSONS and produce only those, which are unique.

# Local development with web-types

You can use web-types in your local project or library. Just link a generated web-types file in your `package.json` and IDE will pick up global components from it.

# Publishing to `@web-types` scope

To publish a package to `@web-types` you need to have permission. Automated publishing is done with
`script/publish.sh` script, which usage syntax is following:
```
publish.sh <package-name> [--dry-run]
```
The script will scan folder `packages/<package-name>` for generated web-types jsons and synchronize
contents with NPM. 

# Versioning and naming of `@web-types` scope
Versioning and naming rules are as follows:
* web-types for package `pkg-name` are available under `@web-types/pkg-name`
* web-types for package `@scope/pkg-name` are available under `@web-types/at-scope-pkg-name`
* web-types for version `1.2.3` are published as prerelease `1.2.3-n`, e.g. `1.2.3-3`
* web-types for pre-release version `1.2.3-rc.1` are published with additional segment, 
  e.g. `1.2.3-rc.1.3`
* to search for appropriate web-types package use range `<pkg-ver` and include prerelease versions, 
  e.g. to find web-types for version `1.2.6`, query package list with `<1.2.6`, which can match 
  web-types in version `1.2.4-12` 
* all outdated versions are marked as deprecated and should be ignored by an IDE

# Contributions

All contributions are welcome! We need your help to improve the web-types standard specification,
to support other frameworks and to improve quality of generated metadata through scripts. 
