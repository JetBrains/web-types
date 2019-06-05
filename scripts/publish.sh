# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit 1

PACKAGE_NAME=$1
shift

# Get list of existing package versions
# shellcheck disable=SC2207
EXISTING_VERSIONS=($(npm view "@web-types/$PACKAGE_NAME" versions | sed 's/[, \['"'"']*\([0-9a-zA-Z\.\-]*\)]*/ \1 /g'))

PACKAGE_VERSION=$1
shift

# Increase build number until new version is found
BUILD_NR=1
while : ; do
  FULL_VER="$PACKAGE_VERSION-$BUILD_NR"
  FOUND=$(printf "%s\n" "${EXISTING_VERSIONS[@]}" | grep "^$FULL_VER$")
  if [[ "$FOUND" == "" ]]; then
    break;
  fi
  ((BUILD_NR++))
done


# Prepare temporary directory
TMP_DIR=publish/tmp

#Cleanup
rm -Rf $TMP_DIR
mkdir -p $TMP_DIR || exit 1

#Copy files
cp publish/package-template.json $TMP_DIR/package.json || exit 1
cp publish/README-template.MD $TMP_DIR/README.MD || exit 1
cp "../packages/$PACKAGE_NAME/$PACKAGE_NAME@$PACKAGE_VERSION.web-types.json" $TMP_DIR/"$PACKAGE_NAME".web-types.json || exit 1

# Replace variables in the templates
cd $TMP_DIR || exit 1

sed -i "" "s/\%PACKAGE_NAME\%/$PACKAGE_NAME/g" package.json || exit 1
sed -i "" "s/\%PACKAGE_VERSION\%/$PACKAGE_VERSION/g" package.json || exit 1
sed -i "" "s/\%BUILD_NR\%/$BUILD_NR/g" package.json || exit 1

sed -i "" "s/\%PACKAGE_NAME\%/$PACKAGE_NAME/g" README.MD || exit 1

# Publish new package version
npm publish --access public
