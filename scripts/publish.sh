function publishVersion() {
  local PACKAGE_VERSION=$1

  echo "*** Synchronizing version $PACKAGE_VERSION"
  cd "$SCRIPT_DIR" || exit 1

  # Figure out separator
  local SEPARATOR="-"
  if [[ "$PACKAGE_VERSION" == *"-"* ]]; then
    SEPARATOR="."
  fi

  # Increase build number until new version is found
  local BUILD_NR=1
  local LATEST_PUBLISHED
  local FULL_VER
  while :; do
    FULL_VER="$PACKAGE_VERSION$SEPARATOR$BUILD_NR"
    local FOUND
    FOUND=$(printf "%s\n" "${EXISTING_VERSIONS_NPM[@]}" | grep "^$FULL_VER$")
    if [[ "$FOUND" == "" ]]; then
      break
    fi
    LATEST_PUBLISHED="$FULL_VER"
    ((BUILD_NR++))
  done

  echo " - full version to publish: $FULL_VER"
  echo " - latest published version: $LATEST_PUBLISHED"
  echo " - preparing temporary directory"
  # Prepare temporary directory
  local TMP_DIR=publish/tmp

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
  sed -i "" "s/\%PACKAGE_VERSION_FULL\%/$FULL_VER/g" package.json || exit 1

  sed -i "" "s/\%PACKAGE_NAME\%/$PACKAGE_NAME/g" README.MD || exit 1

  # Check for errors before publishing
  if [[ $(grep -Fc "#Error" "$PACKAGE_NAME".web-types.json) != "0" ]]; then
    echo " ! found '#Error' in web-types to publish. Aborting."
    exit 1
  fi

  #Check if the content is different
  if [[ "$LATEST_PUBLISHED" != "" ]]; then
    local URL
    URL=$(npm view "@web-types/$PACKAGE_NAME@$LATEST_PUBLISHED" dist.tarball)
    echo " - comparing with currently published: $URL"
    local DIFF_LINES_COUNT
    DIFF_LINES_COUNT=$(curl -s "$URL" | tar -zOx "package/$PACKAGE_NAME.web-types.json" | diff - "$PACKAGE_NAME".web-types.json | grep -c ">\|<")
    echo " - found $DIFF_LINES_COUNT differences"
    if [[ "$DIFF_LINES_COUNT" == "0" ]]; then
      echo " ! skipping publish of version $PACKAGE_VERSION as web-types contents are the same"
      PUBLISHED+=("$LATEST_PUBLISHED")
      return
    fi
  fi

  echo " ! publishing new version"
  # Publish new package version
  if [[ "$DRY_RUN" == "false" ]]; then
    npm publish --access public || exit 1
  fi
  PUBLISHED+=("$FULL_VER")
}

# shellcheck disable=SC2128

cd "$(dirname "$BASH_SOURCE")" || exit 1
SCRIPT_DIR=$(pwd)
echo "Script dir: $SCRIPT_DIR"

# Convert '@scope/package' to 'at-scope-package'
PACKAGE_NAME=$(echo "$1" | sed -e 's/@\(.*\)\/\(.*\)/at-\1-\2/g')
shift

if [[ "$*" == *--dry-run* ]]; then
  echo "Dry-run: true"
  DRY_RUN=true
else
  echo "Dry-run: false"
  DRY_RUN=false
fi

echo "Synchronizing package @web-types/$PACKAGE_NAME"

# Get list of existing package versions
# shellcheck disable=SC2207
EXISTING_VERSIONS_NPM=($(npm view "@web-types/$PACKAGE_NAME" versions | sed 's/[, \['"'"']*\([0-9a-zA-Z\.\-]*\)]*/ \1 /g'))

# shellcheck disable=SC2012
# shellcheck disable=SC2207
TO_PUBLISH=($(ls -1 ../packages/"$PACKAGE_NAME" | sed -e 's/.*@\(.*\)\.web-types\.json/\1/g' | sort -V))

echo "Existing versions: ${EXISTING_VERSIONS_NPM[*]}"
echo "Going to synchronize contents of versions: ${TO_PUBLISH[*]}"

PUBLISHED=()
for version in "${TO_PUBLISH[@]}"; do
  publishVersion "$version" || exit 1
done

TO_DEPRECATE=$(diff <(printf "%s\n" "${PUBLISHED[@]}" | sort -V) <(printf "%s\n" "${EXISTING_VERSIONS_NPM[@]}" | sort -V) | grep ">" | sed -e 's/> //g')

echo "Depracating following versions: ${TO_DEPRECATE[*]}"

# shellcheck disable=SC2068
for version in ${TO_DEPRECATE[@]}; do
  if [[ "$(npm view "@web-types/$PACKAGE_NAME@$version" deprecated)" == "" ]]; then
    echo "- making $version depracated"
    if [[ "$DRY_RUN" == "false" ]]; then
      npm deprecate "@web-types/$PACKAGE_NAME@$version" "Improved version available"
    fi
  else
    echo "- $version is already deprecated, skipping"
  fi
done
