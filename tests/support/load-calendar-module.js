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
const STYLES_PATH = path.join(__dirname, "..", "..", "styles.js");

// Babel-transforms one ESM file to CommonJS and evaluates it, returning its
// exports. Shared by the JSX entry point and its plain-JS "./styles.js"
// import so both run the real source, not a copy.
function loadEsmAsCjs(filePath, requireStubs) {
  const source = fs.readFileSync(filePath, "utf8");
  const { code } = babel.transform(source, {
    filename: filePath,
    presets: [["@babel/preset-react", { runtime: "automatic" }]],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });

  const mod = new Module(filePath, module);
  mod.filename = filePath;
  mod.paths = Module._nodeModulePaths(path.dirname(filePath));
  mod.require = (name) => {
    if (name in requireStubs) return requireStubs[name];
    return require(name);
  };

  const wrapper = Module.wrap(code);
  const compiledWrapper = require("vm").runInThisContext(wrapper, { filename: filePath });
  compiledWrapper.call(
    mod.exports,
    mod.exports,
    mod.require,
    mod,
    filePath,
    path.dirname(filePath)
  );
  mod.loaded = true;
  return mod.exports;
}

function loadCalendarModule() {
  const stubs = {
    react: {},
    "react/jsx-runtime": {},
    "lucide-react": new Proxy(
      {},
      { get: () => () => null } // any icon name resolves to a no-op component
    ),
    styles: loadEsmAsCjs(STYLES_PATH, {}),
  };
  return loadEsmAsCjs(SOURCE_PATH, stubs);
}

module.exports = { loadCalendarModule };
