# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit

node ./build.js > ../web-types.schema.json
