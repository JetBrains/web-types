[![official JetBrains project](https://jb.gg/badges/official.svg)](https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub)

# Web-Types

Welcome to Web-Types, a JSON format for documenting web component libraries.

Web-Types is a framework-agnostic format aimed at providing IDEs and other tools with the metadata information about the contents 
of a component library. Its powerful name patterns allow encoding information about web framework syntax or
customizing code completion suggestions for large icon libraries in the IDEs that support Web-Types.

# Version 2.0 of the format

Web-Types started as a format to support Vue libraries but we've always wanted to provide a more generic solution. 
Finally, version 2.0 of Web-Types format works seamlessly for any kind of web framework, 
Web Components library, or CSS icons pack.

Starting with version 2021.3.1 of [WebStorm](https://www.jetbrains.com/webstorm/) (and other [JetBrains IDEs](https://www.jetbrains.com/products/#lang=js&type=ide)), a full support for the new Web-Types format 
is supported (the new format has been partially supported since 2021.2). You can now add custom HTML elements and 
attributes, custom CSS classes, properties, functions, pseudo-classes, and pseudo-elements. Vue and Angular support 
integrates fully with the format, so you can easily mix Web Components in Angular or Vue templates.

Examples of how basic support for frameworks and libraries is implemented in WebStorm through Web-Types are available
in the `examples` directory.

A webinar recording with Piotr Tomiak explaining the new version of the format and how pattern processing works is available on [YouTube](https://www.youtube.com/watch?v=nkAhI1YyU0w).

The new version of Web-Types is backward compatible with the Vue-only Web-Types.

# Local development with Web-Types

To enable your Web-Types file in the project, link it through the `web-types` property of your local project `package.json` file.
You can specify multiple Web-Types files by providing an array of paths.

# Distribution

Library providers are welcome to include detailed Web-Types JSONs and link them through `web-types`
property in `package.json`. E.g.:
```
{
  ...
  "web-types": "./web-types.json"
  ...
}
```
Currently, the following libraries are providing this feature:
 * Vue.js
   * vuetify (https://github.com/vuetifyjs/vuetify/pull/9440)
   * quasar (https://github.com/quasarframework/quasar/pull/4749)
   * bootstrap-vue (https://github.com/bootstrap-vue/bootstrap-vue/pull/4110)
   * nuxt.js (https://github.com/nuxt/nuxt.js/pull/7611)
   * @ionic/vue (https://github.com/ionic-team/ionic-framework/pull/22428)

For the most popular libraries basic information is published under the `@web-types` scope on NPM. 
Currently, the following frameworks and libraries are supported in such a way:
 * Vue.js
    * bootstrap-vue 
    * quasar
    * quasar-framework
    * vuetify
    * nuxt.js

Published JSONs are checked into this repository under the `packages` folder. In case of Web-Types published to `@web-types` scope, 
IDEs are supposed to download required JSONs without any changes to the user project structure.

Various IDEs perform optimizations when scanning `node_modules` directory, so to ensure that `web-types` for 
your package are always available, make sure it's listed in `packages/registry.json`.

# Schema

Web-Types JSON Schema is available in the `schema` folder. Use one of the following URLs to reference it in your JSON files:
```
http://json.schemastore.org/web-types
```
or
```
https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json
```

# Generating Web-Types

### From source

Currently, the following component documentation formats are supported:
- JSDoc using [styleguidist](https://vue-styleguidist.github.io/docs/Documenting.html#code-comments) `vue-docgen-api`
  library - add [`vue-docgen-web-types`](https://www.npmjs.com/package/vue-docgen-web-types) package to your project 
  and run the `vue-docgen-web-types` command. You can launch it in a watch mode by passing `--watch` and 
  you can pass a custom configuration file via `--config` parameter. 
  See [config.d.ts](https://github.com/JetBrains/web-types/blob/master/gen/vue-docgen-web-types/types/config.d.ts)
  for detailed information on supported configuration file options.
  
If you're not using JSDoc in your project, you can create your own builder for `web-types` JSON. For examples see
vuetify, quasar or bootstrap-vue pull requests from above.

# Publishing to `@web-types` scope

We welcome your PRs with Web-Types for libraries in `packages` folder. There should be a single file per library in the format:

```
packages/<pkg-name>/<pkg-name>@<pkg-version>.web-types.json
```

We are syncing contents of the `packages` folder using `script/publish.sh` script which usage syntax is following:
```
publish.sh <package-name> [--dry-run]
```
The script scans folder `packages/<package-name>` for provided Web-Types jsons and synchronizes
contents with NPM.

# Versioning and naming of `@web-types` scope
Versioning and naming rules are as follows:
* Web-Types for package `pkg-name` are available under `@web-types/pkg-name`
* Web-Types for package `@scope/pkg-name` are available under `@web-types/at-scope-pkg-name`
* Web-Types for version `1.2.3` are published as prerelease `1.2.3-n`, e.g. `1.2.3-3`
* Web-Types for pre-release version `1.2.3-rc.1` are published with additional segment, 
  e.g. `1.2.3-rc.1.3`
* to search for appropriate Web-Types package use range `<pkg-ver` and include prerelease versions, 
  e.g. to find Web-Types for version `1.2.6`, query package list with `<1.2.6`, which can match 
  Web-Types in version `1.2.4-12` 
* all outdated versions are marked as deprecated and should be ignored by an IDE

# Contributions

All contributions are welcome! We need your help to improve the Web-Types format specification,
to support other frameworks and to improve quality of generated metadata through scripts. 
