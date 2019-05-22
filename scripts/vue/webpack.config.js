const pkg = process.env.LIBRARY_NAME;

module.exports = {
    mode: "development",
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [{
                    loader: "string-replace-loader",
                    options: {
                        search: "$$PACKAGE$$",
                        replace: pkg
                    }
                }, {
                    loader: 'babel-loader'
                }]

            },
            {
                test: /\.js$/,
                include:
                    new RegExp("node_modules\/" + pkg + "/"),
                use:
                    [{
                        loader: "./webpack/id-injector.js"
                    }]
            }, {
                test: /\.ts$/,
                use:
                    [{
                        loader: "awesome-typescript-loader"
                    }]

            }
        ]
    },
    resolve: {
        alias: {
            'vue$':
                'vue/dist/vue.esm.js'
        },
        extensions: [ '*',
            // for quasar framework
            ".mat.js", ".ios.js",
            // regular
            '.js', '.vue', '.json', ".ts"]
    },
    devtool: "cheap-source-map"
};
