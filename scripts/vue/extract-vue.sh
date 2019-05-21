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
echo "Compile extraction script together with $PACKAGE using webpack"
node_modules/.bin/webpack main.js || exit
mkdir -p ../../packages/"$PACKAGE"
echo
echo "Run extraction script"
node dist/main.js > ../../packages/"$PACKAGE/$PACKAGE@$VERSION".web-types.json
echo "Done! Results saved to $(cd ../../packages/"$PACKAGE" || exit; pwd)/$PACKAGE@$VERSION.web-types.json"
