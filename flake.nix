{
  description = "A digital garden blog";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      # Define which CPU/OS combinations we support
      # aarch64-darwin = Apple Silicon Macs (M1/M2/M3)
      # x86_64-darwin = Intel Macs
      # x86_64-linux = Intel/AMD Linux
      # aarch64-linux = ARM Linux (Raspberry Pi, AWS Graviton, etc.)
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
        "aarch64-linux"
      ];

      # Helper function from nixpkgs that generates attributes for all systems
      # It maps over the 'systems' list and calls our function for each one
      # Result: { aarch64-darwin = {...}; x86_64-darwin = {...}; ... }
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      # DEVSHELLS: Development environments accessible via `nix develop`
      # We generate one shell per system (macOS ARM, macOS Intel, Linux, etc.)
      devShells = forAllSystems (
        system:
        let
          # Import nixpkgs for this specific system
          # This gives us access to packages built for this CPU/OS combo
          pkgs = import nixpkgs { inherit system; };
        in
        {
          # The default shell (you can have multiple named shells)
          # `nix develop` enters this shell; `nix develop .#name` enters others
          default = pkgs.mkShell {
            # PACKAGES: Software available inside the shell
            # These are added to PATH when you enter the shell
            # nodejs_24 = Node.js version 24.x (matches your .nvmrc)
            packages = with pkgs; [
              nodejs_24
              nixfmt
            ];

            # SHELLHOOK: Commands that run automatically when entering the shell
            # This is a bash script that executes on `nix develop`
            shellHook = ''
              echo "🌱 Digital Garden dev environment"
              echo "Node: $(node --version)"
              echo ""
              echo "Commands:"
              echo "  npm install  - Install dependencies"
              echo "  npm start    - Start dev server"
            '';
          };
        }
      );
    };
}
