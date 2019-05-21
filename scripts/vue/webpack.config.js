const pkg = process.env.PACKAGE;

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
                        loader: "./id-injector.js"
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
            '.js', '.vue', '.json',]
    },
    devtool: "cheap-source-map"
};
