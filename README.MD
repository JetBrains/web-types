[![GitHub license](https://img.shields.io/badge/license-Apache%20License%202.0-blue.svg?style=flat)](https://www.apache.org/licenses/LICENSE-2.0)

# Web-types

Welcome to web-types, the JSON standard to document web component libraries.

Web-types is a framework-agnostic standard to provide IDEs and other tools with metadata information about contents 
of a web components library. It also provides extensions for a framework specific content.

You can check out features supported by IDEs [here](https://github.com/JetBrains/web-types/wiki/Features-supported-by-IDEs).

# Upcoming version 2.0 of the standard

For last couple of months we have been working very hard to create a version of web-types, which 
would work seamlessly for any kind of web framework, or even for libraries, which modify HTML
in a custom way.

The preview of [new web-types schema](https://github.com/JetBrains/web-types/blob/master/v2-preview/web-types.json)
is available in `v2-preview` folder. There is also [an example web-types file](https://github.com/JetBrains/web-types/blob/master/v2-preview/vue@3.0.0.web-types.json), 
which describes support for Vue framework in detail.

You can preview the new support in WebStorm (and other JetBrains IDEs) through [Early Access Program](https://www.jetbrains.com/webstorm/nextversion/) of 2020.2 version.
To enable your web-types file in the project, link it through `web-types` property of your local `package.json` file.
You can specify multiple web-types files by providing an array of paths.

**Support is still in preview mode and schema may change**. The goal of preview phase is to gather 
feedback from the community and improve the format. Therefore, please do not bundle any web-types (in the new format) 
with your libraries yet.

The new version of web-types provides legacy support for Vue-only web-types.

# Distribution

Library providers are welcome to include detailed web-types JSONs and link them through `web-types`
property in `package.json`. E.g.:
```
{
  ...
  "web-types": "./web-types.json"
  ...
}
```
Currently following libraries are providing this feature:
 * Vue.js
   * vuetify (https://github.com/vuetifyjs/vuetify/pull/9440)
   * quasar (https://github.com/quasarframework/quasar/pull/4749)
   * bootstrap-vue (https://github.com/bootstrap-vue/bootstrap-vue/pull/4110)
   * nuxt.js (https://github.com/nuxt/nuxt.js/pull/7611)
   * @ionic/vue (https://github.com/ionic-team/ionic-framework/pull/22428)

For the most popular libraries basic information is published under `@web-types` scope on NPM. 
Currently following frameworks and libraries are supported in such a way:
 * Vue.js
    * bootstrap-vue 
    * quasar
    * quasar-framework
    * vuetify
    * nuxt.js

Published JSONs are checked into repository under `packages` folder. In case of web-types published to `@web-types` scope,  IDEs are supposed to download required JSONs without any changes to user project structure.

Various IDEs perform optimizations when scanning `node_modules` directory, so to ensure that `web-types` for 
your package are always available, make sure it's listed in `packages/registry.json`.

# Schema

Web-types schema is available in `schema` folder. Use one of the following URLs to reference it in your JSON files:
```
http://json.schemastore.org/web-types
```
or
```
https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json
```


# Generating web-types

### From source

Currently, following component documentation formats are supported:
- JSDoc using [styleguidist](https://vue-styleguidist.github.io/docs/Documenting.html#code-comments) `vue-docgen-api`
  library - add [`vue-docgen-web-types`](https://www.npmjs.com/package/vue-docgen-web-types) package to your project 
  and run `vue-docgen-web-types` command. You can launch it in a watch mode by passing `--watch` and 
  you can pass a custom configuration file via `--config` parameter. 
  See [config.d.ts](https://github.com/JetBrains/web-types/blob/master/gen/vue-docgen-web-types/types/config.d.ts)
  for detailed information on supported configuration file options.
  
If you're not using JSDoc in your project, you can create your own builder for `web-types` JSON. For examples see
vuetify, quasar or bootstrap-vue pull requests from above.

### From published NPM packages for inclusion in @web-types namespace
To extract metadata information from NPM published library you can use `scripts/extract.sh` bash script. 
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
