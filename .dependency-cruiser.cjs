const config = require("@jakubszwajka/house-rules/dependency-cruiser").layout({
  scope: "@hosti/",
});

config.options.exclude.path = `${config.options.exclude.path}|^packages/rules/`;

module.exports = config;
