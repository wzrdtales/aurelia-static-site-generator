const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const project = require('./aurelia_project/aurelia.json');
const {
  AureliaPlugin,
  ModuleDependenciesPlugin
} = require('aurelia-webpack-plugin');
const { ProvidePlugin } = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const nodeExternals = require('webpack-node-externals');

// config helpers:
const ensureArray = config =>
  (config && (Array.isArray(config) ? config : [config])) || [];
const when = (condition, config, negativeConfig) =>
  condition ? ensureArray(config) : ensureArray(negativeConfig);

// primary config:
const title = 'WizardTales';
const outDir = path.resolve(__dirname, project.platform.output);
const srcDir = path.resolve(__dirname, 'src');
const nodeModulesDir = path.resolve(__dirname, 'node_modules');
const baseUrl = '/';

const cssRules = [
  {
    loader: 'css-loader',
    options: {
      minimize: true
    }
  },
  {
    loader: 'postcss-loader',
    options: {
      plugins: () => [
        require('autoprefixer')({ browsers: ['last 2 versions'] }),
        require('postcss-color-function'),
        require('cssnano')({ preset: 'default' })
      ],
      minimize: true
    }
  }
];

module.exports = ({
  production,
  server,
  extractCss,
  coverage,
  analyze,
  karma,
  ssr
} = {}) => ({
  target: 'node',
  node: {
    __dirname: true
  },
  mode: 'production',
  resolve: {
    extensions: ['.ts', '.js'],
    modules: [srcDir, nodeModulesDir],
    // Enforce single aurelia-binding, to avoid v1/v2 duplication due to
    // out-of-date dependencies on 3rd party aurelia plugins
    alias: {
      'aurelia-binding': path.resolve(__dirname, 'node_modules/aurelia-binding')
    }
  },
  entry: {
    server: './src/server-main.js'
  },
  externals: [
    nodeExternals({
      whitelist: [
        // these things should be in the webpack bundle
        // other node_modules need to be left out
        /font-awesome|bootstrap|-loader|aurelia-(?!pal-nodejs|pal|polyfills|bootstrapper)/
      ]
    })
  ],
  output: {
    path: outDir,
    publicPath: baseUrl,
    filename: production ? '[name].bundle.js' : '[name].bundle.js',
    sourceMapFilename: production ? '[name].bundle.map' : '[name].bundle.map',
    chunkFilename: production ? '[name].[chunkhash].chunk.js' : '[id].chunk.js',
    libraryTarget: 'commonjs2'
  },
  optimization: {
    runtimeChunk: false, // separates the runtime chunk, required for long term cacheability
    // moduleIds is the replacement for HashedModuleIdsPlugin and NamedModulesPlugin deprecated in https://github.com/webpack/webpack/releases/tag/v4.16.0
    // changes module id's to use hashes be based on the relative path of the module, required for long term cacheability
    moduleIds: 'hashed'
    // Use splitChunks to breakdown the App/Aurelia bundle down into smaller chunks
    // https://webpack.js.org/plugins/split-chunks-plugin/
  },
  performance: { hints: false },
  devServer: {
    contentBase: outDir
    // serve index.html for all 404 (required for push-state)
    //historyApiFallback: true
  },
  module: {
    rules: [
      // CSS required in JS/TS files should use the style-loader that auto-injects it into the website
      // only when the issuer is a .js/.ts file, so the loaders are not applied inside html templates
      {
        test: /\.css$/i,
        issuer: [{ not: [{ test: /\.html$/i }] }],
        use: extractCss
          ? [
            {
              loader: MiniCssExtractPlugin.loader
            },
            'css-loader',
            'postcss-loader'
          ]
          : ['style-loader', ...cssRules]
      },
      {
        test: /\.css$/i,
        issuer: [{ test: /\.html$/i }],
        // CSS required in templates cannot be extracted safely
        // because Aurelia would try to require it again in runtime
        use: cssRules
      },
      { test: /\.html$/i, loader: 'html-loader' },
      {
        test: /\.js$/i,
        loader: 'babel-loader',
        exclude: nodeModulesDir,
        options: coverage ? { sourceMap: 'inline', plugins: ['istanbul'] } : {}
      },
      // exposes jQuery globally as $ and as jQuery:
      {
        test: require.resolve('jquery'),
        loader: 'expose-loader?$!expose-loader?jQuery'
      },
      // embed small images and fonts as Data Urls and larger ones as files:
      {
        test: /\.(png|gif|jpg|cur)$/i,
        loader: 'url-loader',
        options: { limit: 8192 }
      },
      {
        test: /\.woff2(\?v=[0-9]\.[0-9]\.[0-9])?$/i,
        loader: 'url-loader',
        options: { limit: 10000, mimetype: 'application/font-woff2' }
      },
      {
        test: /\.woff(\?v=[0-9]\.[0-9]\.[0-9])?$/i,
        loader: 'url-loader',
        options: { limit: 10000, mimetype: 'application/font-woff' }
      },
      // load these fonts normally, as files:
      {
        test: /\.(ttf|eot|svg|otf)(\?v=[0-9]\.[0-9]\.[0-9])?$/i,
        loader: 'file-loader'
      }
    ]
  },
  plugins: [
    ...when(!karma, new DuplicatePackageCheckerPlugin()),
    new AureliaPlugin({
      features: {
        polyfills: 'none'
      }
    }),
    new ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery'
    }),
    new ProvidePlugin({
      Promise: 'bluebird'
    }),
    new CopyWebpackPlugin([
      { from: 'static/favicon.ico', to: 'favicon.ico' },
      { from: 'static/sitemap.xml', to: 'sitemap.xml' },
      {
        from: 'node_modules/preboot/__dist/preboot_browser.js',
        to: 'preboot_browser.js'
      }
    ]),
    new HtmlWebpackPlugin({
      template: 'index.ejs',
      minify: production
        ? {
          removeComments: true,
          collapseWhitespace: true,
          collapseInlineTagWhitespace: true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes: true,
          minifyCSS: true,
          minifyJS: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          ignoreCustomFragments: [/\${.*?}/g]
        }
        : undefined,
      metadata: {
        // available in index.ejs //
        title,
        server,
        baseUrl
      }
    }),
    // ref: https://webpack.js.org/plugins/mini-css-extract-plugin/
    ...when(
      extractCss,
      new MiniCssExtractPlugin({
        // updated to match the naming conventions for the js files
        filename: production
          ? 'css/[name].[contenthash].bundle.css'
          : 'css/[name].[hash].bundle.css',
        chunkFilename: production
          ? 'css/[name].[contenthash].chunk.css'
          : 'css/[name].[hash].chunk.css'
      })
    ),
    ...when(
      production || server,
      new CopyWebpackPlugin([
        { from: 'static', to: outDir, ignore: ['.*'] }
        //{ from: 'static/favicon.ico', to: 'favicon.ico' }
      ])
    ), // ignore dot (hidden) files
    ...when(analyze, new BundleAnalyzerPlugin())
  ]
});
