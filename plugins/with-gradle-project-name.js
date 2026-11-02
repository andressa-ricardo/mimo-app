const { withSettingsGradle } = require('expo/config-plugins');

/**
 * The app is displayed as "mimo." (with the period), but prebuild also uses the
 * app name as Gradle's rootProject.name, and Gradle rejects names that start or
 * end with ".". This keeps the launcher label and only renames the Gradle project.
 */
module.exports = function withGradleProjectName(config, { name = 'mimo' } = {}) {
  return withSettingsGradle(config, (settings) => {
    settings.modResults.contents = settings.modResults.contents.replace(
      /rootProject\.name\s*=\s*['"][^'"]*['"]/,
      `rootProject.name = '${name}'`,
    );
    return settings;
  });
};
