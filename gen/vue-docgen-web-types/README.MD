This package provides `vue-docgen-web-types` command to generate [web-types](https://github.com/JetBrains/web-types) 
JSON based on source components. It parses JSDoc using 
[styleguidist](https://vue-styleguidist.github.io/docs/Documenting.html#code-comments) `vue-docgen-api` package.

You can launch builder in a watch mode by passing `--watch` and
you can pass a custom configuration file via `--configFile` parameter.
See [config.d.ts](https://github.com/JetBrains/web-types/blob/master/gen/vue-docgen-web-types/types/config.d.ts)
for detailed information on supported configuration file options.
