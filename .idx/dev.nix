{ pkgs, ... }: {
  channel = "unstable";
  packages = [
    pkgs.nodejs_24
    pkgs.pnpm
    pkgs.gnupg
    pkgs.openssh
  ];
  idx = {
    extensions = [
      "mhutchie.git-graph"
      "oderwat.indent-rainbow"
      "esbenp.prettier-vscode"
      "google.gemini-cli-vscode-ide-companion"
      "astro-build.astro-vscode"
      "dbaeumer.vscode-eslint"
      "IBM.output-colorizer"
      "stylelint.vscode-stylelint"
      "bradlc.vscode-tailwindcss"
    ];
    workspace = {
      onCreate = {
        install = "pnpm install";
        cf_types = "pnpm cf-typegen";
        build = "pnpm build";
        default.openFiles = [ "src/pages/index.astro" ];
      };
      onStart = { default.openFiles = [ "src/pages/index.astro" ]; };
    };
  };
}
