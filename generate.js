const Promise = require("bluebird");
const rp = require("request-promise");
const net = require("net");
const cp = require("child_process");
const fs = require("fs");
const writeFile = Promise.promisify(fs.writeFile);
require("@babel/register")({
  presets: ["@babel/preset-env"]
});
const Routes = require("./src/routes");
const API = "http://localhost:8084";

function build() {
  const npm = cp.spawn("npm", ["start", "webpack.server.ssr.build"]);
  npm.stdout.on("data", data => {
    console.log(data.toString());
  });

  npm.stderr.on("data", data => {
    console.error(data.toString());
  });

  return new Promise((resolve, reject) => {
    npm.on("close", code => {
      if (!code) return resolve();

      return reject(code);
    });
  });
}

function server() {
  const s = cp.spawn("node", ["server.js"]);

  s.stdout.on("data", data => {
    console.log(data.toString());
  });

  s.stderr.on("data", data => {
    console.error(data.toString());
  });

  return s;
}

async function waitForServer() {
  let check;
  check = function(resolve, reject) {
    setTimeout(() => {
      console.log("trying to connect to server");
      const client = net.connect({ port: 8084 }, () => {
        client.end();
        if (resolve) resolve();
      });
      client.setTimeout(300);

      client.on("timeout", () => {
        client.end();
        check(resolve, reject);
      });

      client.on("error", () => {
        client.end();
        check(resolve, reject);
      });
    }, 300);
  };

  return new Promise((resolve, reject) => {
    check(resolve, reject);
  });
}

async function getPages() {
  return Promise.resolve(Object.keys(Routes))
    .reduce((arr, router) => {
      let prefix = "";
      if (Routes[router].prefix) {
        prefix = router.prefix;
        router = Routes[router].config;
      } else {
        router = Routes[router];
      }

      return arr.concat(
        router.map(route => {
          const path = `${prefix}/${
            typeof route.route === "string" ? route.route : route.route[0]
          }`;
          return { path, route, res: rp(`${API}${path}`) };
        })
      );
    }, [])
    .map(data => {
      if (data.path === "/") {
        data.path = "/main.html";
      } else {
        data.path += ".html";
      }
      return data.res.then(body => {
        console.log(`Writing ${data.path}`);
        return writeFile(`./dist${data.path}`, body);
      });
    });
}

(async () => {
  await build();

  const notFound = Routes.NotFound;
  delete Routes.NotFound;
  const s = server();
  await waitForServer();

  console.log("successfully started and connected to server");
  await getPages();

  s.kill("SIGHUP");
})();

console.log(Routes);
