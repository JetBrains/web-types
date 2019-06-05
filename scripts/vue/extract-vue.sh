# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit
export LIBRARY_NAME=$1
export LIBRARY_VERSION=$2
if [ "$LIBRARY_NAME" == "" ] || [ "$LIBRARY_VERSION" == "" ]; then
  echo "Usage extract.sh vue [package] [version]"
  exit
fi
echo "--== Extracting web-types from $LIBRARY_NAME@$LIBRARY_VERSION ==--"
echo
echo "Ensure script dependencies are up to date."
npm install
echo
echo "Install $LIBRARY_NAME@$LIBRARY_VERSION"
npm install --no-save "$LIBRARY_NAME"@"$LIBRARY_VERSION" || exit
echo
echo "Compile dynamic analisys script together with $LIBRARY_NAME using webpack"
node_modules/.bin/webpack dynamic/main.js -o tmp/dynamic.js || exit
mkdir -p ../../packages/"$LIBRARY_NAME"
echo
echo "Run dynamic analisys script"
node tmp/dynamic.js > tmp/dynamic.out.json || exit
echo
echo "Compile static analisys script using tsc"
node_modules/.bin/tsc || exit
echo
echo "Run static analisys script"
node tmp/static/main.js "$(pwd)/tmp/dynamic.js" "$(pwd)/tmp/dynamic.out.json" "$@" > ../../packages/"$LIBRARY_NAME/$LIBRARY_NAME@$LIBRARY_VERSION".web-types.json || exit
echo
echo "Done! Results saved to $(cd ../../packages/"$LIBRARY_NAME" || exit; pwd)/$LIBRARY_NAME@$LIBRARY_VERSION.web-types.json"
