const { withProjectBuildGradle } = require("expo/config-plugins");
const path = require("node:path");

/** Keep generated C++ paths short on Windows while the source stays in its workspace. */
module.exports = function withShortCmakePath(config) {
  return withProjectBuildGradle(config, (config) => {
    const staging = path.resolve(config.modRequest.projectRoot, ".cxx").replace(/\\/g, "/");
    const rule =
      '\nsubprojects { nativeProject ->\n' +
      '    ["com.android.application", "com.android.library"].each { pluginId ->\n' +
      '        nativeProject.plugins.withId(pluginId) {\n' +
      '            nativeProject.extensions.getByName("androidComponents").finalizeDsl { android ->\n' +
      '                android.externalNativeBuild.cmake.buildStagingDirectory = new File("' +
      staging +
      '", nativeProject.name)\n' +
      '                android.defaultConfig.externalNativeBuild.cmake.arguments "-DCMAKE_OBJECT_PATH_MAX=250"\n' +
      '            }\n        }\n    }\n}\n';
    const rootPlugin = 'apply plugin: "expo-root-project"';
    if (!config.modResults.contents.includes(rootPlugin)) {
      throw new Error("Cannot configure native paths before the Expo root plugin");
    }
    config.modResults.contents = config.modResults.contents.replace(rootPlugin, rule + "\n" + rootPlugin);
    return config;
  });
};
