const { series, crossEnv, concurrent, rimraf } = require('nps-utils');

module.exports = {
  scripts: {
    default: 'nps webpack',
    test: {
      default: 'nps test.jest',
      jest: {
        default: series(
          rimraf('test/coverage-jest'),
          crossEnv('BABEL_TARGET=node jest')
        ),
        accept: crossEnv('BABEL_TARGET=node jest -u'),
        watch: crossEnv('BABEL_TARGET=node jest --watch')
      },

      lint: {
        default: 'eslint src',
        fix: 'eslint src --fix'
      },
      all: concurrent({
        jest: 'nps test.jest',
        lint: 'nps test.lint'
      })
    },
    build: 'nps webpack.build',
    webpack: {
      default: 'nps webpack.server',
      build: {
        before: rimraf('dist'),
        default: 'nps webpack.build.production',
        development: {
          default: series('nps webpack.build.before', 'webpack --progress -d'),
          extractCss: series(
            'nps webpack.build.before',
            'webpack --progress -d --env.extractCss'
          ),
          serve: series.nps('webpack.build.development', 'serve')
        },
        production: {
          inlineCss: series(
            'nps webpack.build.before',
            crossEnv(
              'NODE_ENV=production webpack --progress -p --env.production'
            )
          ),
          default: series(
            'nps webpack.build.before',
            crossEnv(
              'NODE_ENV=production webpack --progress -p --env.production --env.extractCss'
            )
          ),
          serve: series.nps('webpack.build.production', 'serve'),
          ssr: series(
            'nps webpack.build.before',
            'webpack --progress -p --env.production --env.extractCss',
            'webpack --config webpack.server.config.js --progress -p --env.production --env.extractCss'
          )
        }
      },
      server: {
        default:
          "webpack-dev-server -d --devtool '#source-map' --inline --env.server",
        extractCss:
          "webpack-dev-server -d --devtool '#source-map' --inline --env.server --env.extractCss",
        hmr:
          "webpack-dev-server -d --devtool '#source-map' --inline --hot --env.server",
        ssr: {
          watch: series.nps(
            'webpack.build.before',
            'webpack.server.ssr.bundleandwatch'
          ),
          build: series.nps(
            'webpack.build.before',
            'webpack.server.ssr.bundle'
          ),
          bundleandwatch: concurrent({
            client:
              'webpack --watch --env.ssr --env.production --env.extractCss',
            server:
              'webpack --config webpack.server.config.js --watch --env.extractCss'
          }),
          bundle: concurrent({
            client: 'webpack --env.extractCss --env.ssr --env.production',
            server: 'webpack --config webpack.server.config.js --env.extractCss'
          }),
          start: 'nodemon ./server.js' // start: `node --inspect=0.0.0.0:9228 ./server.js`
        }
      }
    },
    serve: 'http-server dist --cors'
  }
};
