const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// Start Expo from this folder only:
//   cd mobile && npx expo start --clear
// `npx expo` from the hackrice repo root makes Metro look in ../../node_modules
// (or downloads Expo 57 via npx) and then expo-asset / FontLoader fail to resolve.
const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
// Keep hierarchical lookup so nested @react-native/* packages resolve.
// Pin critical packages so Metro still prefers mobile/node_modules
// even if Expo is started from the repo root.
config.resolver.extraNodeModules = {
  "expo-asset": path.resolve(projectRoot, "node_modules/expo-asset"),
  "expo-font": path.resolve(projectRoot, "node_modules/expo-font"),
  "@react-native/virtualized-lists": path.join(
    __dirname,
    "node_modules/@react-native/virtualized-lists"
  ),
};

module.exports = config;
