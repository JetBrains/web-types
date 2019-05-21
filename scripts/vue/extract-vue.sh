# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit
export PACKAGE=$1
VERSION=$2
if [ "$PACKAGE" == "" ] || [ "$VERSION" == "" ]; then
  echo "Usage extract.sh vue [package] [version]"
  exit
fi
echo "--== Extracting web-types from $PACKAGE@$VERSION ==--"
echo
echo "Ensure script dependencies are up to date."
npm install
echo
echo "Install $PACKAGE@$VERSION"
npm install --no-save "$PACKAGE"@"$VERSION" || exit
echo
echo "Compile dynamic analisys script together with $PACKAGE using webpack"
node_modules/.bin/webpack dynamic/main.js -o tmp/dynamic.js || exit
mkdir -p ../../packages/"$PACKAGE"
echo
echo "Run dynamic analisys script"
node tmp/dynamic.js > tmp/dynamic.out.json || exit
echo
echo "Compile static analisys script using tsc"
node_modules/.bin/tsc || exit
echo
echo "Run static analisys script"
node tmp/static/main.js "$(pwd)/tmp/dynamic.js" "$(pwd)/tmp/dynamic.out.json" > ../../packages/"$PACKAGE/$PACKAGE@$VERSION".web-types.json || exit
echo "Done! Results saved to $(cd ../../packages/"$PACKAGE" || exit; pwd)/$PACKAGE@$VERSION.web-types.json"
