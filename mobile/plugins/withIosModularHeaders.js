const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Plugin que injeta `use_modular_headers!` no Podfile para corrigir o erro
 * "The Swift pod WatermelonDB depends upon simdjson, which does not define modules"
 * no EAS Build (Install pods).
 * Deve ser listado depois do @morrowdigital/watermelondb-expo-plugin.
 */
function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = await fs.promises.readFile(podfilePath, "utf-8");

      // Inserir use_modular_headers! dentro do target, após use_native_modules!
      // para que simdjson e outros pods usem modular headers (exigido pelo WatermelonDB).
      if (contents.includes("use_modular_headers!")) {
        return config;
      }
      // Aceita variação de formatação (com ou sem espaços extras)
      const marker = /config\s*=\s*use_native_modules!\s*\(\s*config_command\s*\)/;
      if (marker.test(contents)) {
        contents = contents.replace(
          marker,
          (match) => `${match}\n\n  use_modular_headers!`
        );
        await fs.promises.writeFile(podfilePath, contents);
      } else if (contents.includes("use_expo_modules!")) {
        // Fallback: inserir após use_expo_modules!
        contents = contents.replace(
          /use_expo_modules!\s*\n/,
          "use_expo_modules!\n\n  use_modular_headers!\n"
        );
        await fs.promises.writeFile(podfilePath, contents);
      }
      return config;
    },
  ]);
}

module.exports = withIosModularHeaders;
