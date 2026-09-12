const { getDefaultConfig } = require("expo/metro-config");

// Always start Expo from this folder: cd mobile && npx expo start --clear --go
module.exports = getDefaultConfig(__dirname);
