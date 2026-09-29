{
  description = "A development environment for my personal blog: thunk.blog";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            shfmt
            shellcheck
          ];

          # SHELLHOOK: Commands that run automatically when entering the shell
          # This is a bash script that executes on `nix develop`
          shellHook = ''
            echo "🌱 Digital Garden dev environment"
            echo "Node: $(node --version)"
            echo "NPM: $(npm --version)"
          '';
        };
      }
    );
}
