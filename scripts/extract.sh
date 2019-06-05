# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit 1

FRAMEWORK_TYPE=$1
shift

PACKAGE_NAME=$1
shift

VERSION_RANGE=$1
shift

VERSIONS=$(npm view "$PACKAGE_NAME@$VERSION_RANGE" version | sed "s/.*'\([0-9.a-zA-Z\-]*\)'\$/\1/")

if [[ "$VERSIONS" == "" ]]; then
  echo "There are no versions of '$PACKAGE_NAME' matching '$VERSION_RANGE'"
  exit 1
fi

echo "Performing operation for the following versions: "
echo "$VERSIONS" | paste -sd " " -

for PACKAGE_VERSION in $VERSIONS; do
  case $FRAMEWORK_TYPE in
    vue)
      ./vue/extract-vue.sh "$PACKAGE_NAME" "$PACKAGE_VERSION" "$@" || exit 1
      ;;
    *)
      echo "Usage: extract.sh {vue} {package-name} {sem-version-range} [--production,--discard-same]"
      exit 1
  esac
done

# Remove JSONs which have a newer version, but same content as older version
if [[ "$*" == *--discard-same* ]] ; then
  # shellcheck disable=SC2206
  versions_arr=( $VERSIONS )
  cd "../packages/$PACKAGE_NAME" || exit 1

  for ((idx=${#versions_arr[@]} - 1; idx>0; --idx)); do
    DELETE_CAND="$PACKAGE_NAME@${versions_arr[idx]}.web-types.json"
    BASE="$PACKAGE_NAME@${versions_arr[idx-1]}.web-types.json"

    DIFF_LINES_COUNT=$(diff "$DELETE_CAND" "$BASE" | grep -c ">\|<")

    if [[ "$DIFF_LINES_COUNT" == "2" ]]; then
      echo "Deleting newer version file with same content: $DELETE_CAND"
      rm "$DELETE_CAND"
    fi

  done

fi

