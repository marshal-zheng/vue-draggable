const path = require('path');
const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader')
const ESLintPlugin = require('eslint-webpack-plugin')

// Builds web module. Only really used in example code / static site.
module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      'vue-draggable.min': './lib/cjs.ts',
    },
    output: {
      filename: '[name].js',
      sourceMapFilename: '[name].js.map',
      devtoolModuleFilenameTemplate: '../[resource-path]',
      library: 'VueDraggable',
      libraryTarget: 'umd',
      path: path.resolve(__dirname, 'build', 'web'),
    },
    devServer: {
      hot: true,
      open: 'example/index.html',
      client: {
        overlay: true,
      },
      devMiddleware: {
        writeToDisk: true,
      },
      static: {
        directory: '.',
      }
    },
    externals: {
      vue: {
        commonjs: 'vue',
        commonjs2: 'vue',
        amd: 'vue',
        root: 'Vue'
      }
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: 'babel-loader',
          },
          exclude: /node_modules/,
        },
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new VueLoaderPlugin(),
      new webpack.EnvironmentPlugin({
        // these are default values
        DRAGGABLE_DEBUG: false,
        NODE_ENV: ['development', 'production'].includes(argv.mode) ? argv.mode : 'production'
      }),
      // Scope hoisting
      new webpack.optimize.ModuleConcatenationPlugin(),
      new ESLintPlugin({
        extensions: ['js', 'vue', 'ts', 'tsx'],
      }),
    ],
    optimization: {
      minimize: isProduction,
    },
    stats: {
      errorDetails: true,
    }
  }
};
