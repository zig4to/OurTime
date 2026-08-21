// Loads the real skupni-koledar.jsx (no copy, no duplication) so unit tests
// exercise the exact source the browser runs. The file mixes plain helper
// functions with a JSX-rendering React component; Node can't even parse JSX
// syntax, so the whole file is Babel-transformed to CommonJS first. The
// helper functions are pure and never call React, so "react"/"lucide-react"
// only need to resolve (via require stubs below) -- they're never invoked,
// since this harness never renders <App />.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");
const Module = require("module");

const SOURCE_PATH = path.join(__dirname, "..", "..", "skupni-koledar.jsx");

function loadCalendarModule() {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const { code } = babel.transform(source, {
    filename: SOURCE_PATH,
    presets: [["@babel/preset-react", { runtime: "automatic" }]],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });

  const stubs = {
    react: {},
    "react/jsx-runtime": {},
    "lucide-react": new Proxy(
      {},
      { get: () => () => null } // any icon name resolves to a no-op component
    ),
  };

  const mod = new Module(SOURCE_PATH, module);
  mod.filename = SOURCE_PATH;
  mod.paths = Module._nodeModulePaths(path.dirname(SOURCE_PATH));
  mod.require = (name) => {
    if (name in stubs) return stubs[name];
    return require(name);
  };

  const wrapper = Module.wrap(code);
  const compiledWrapper = require("vm").runInThisContext(wrapper, {
    filename: SOURCE_PATH,
  });
  compiledWrapper.call(
    mod.exports,
    mod.exports,
    mod.require,
    mod,
    SOURCE_PATH,
    path.dirname(SOURCE_PATH)
  );
  mod.loaded = true;
  return mod.exports;
}

module.exports = { loadCalendarModule };
