# Setup Scripts

This directory contains scripts to simplify the setup and running of various components.

## Future Available Scripts
| `scripts/setup/local_dex` | Runs kong_backend locally and runs the API locally |

## Usage

Choose the appropriate script for your needs and run it from the project root directory.

## API Submodule Setup

The KONG APIs are included as a Git submodule. For developers with access to the private repository:

```bash
# After cloning the main repo
git submodule init
git submodule update
```

This will populate the `apis/` directory with the API code.

Note: Developers without access to the private KongSwap/apis repository will see an empty directory and will get permission errors when trying to initialize the submodule.

### Submodule Maintenance
To update the API submodule to the latest version:

When you navigate to the API submodule directory, you'll be working with the API's git repository. From there, you can use standard git commands to update it:
```bash
cd apis
git pull origin main
cd ..
git add apis
git commit -m "Update API submodule"
```