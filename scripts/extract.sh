# shellcheck disable=SC2128
cd "$(dirname "$BASH_SOURCE")" || exit
FRAMEWORK_TYPE=$1
shift;

case $FRAMEWORK_TYPE in
  vue)
    ./vue/extract-vue.sh "$@"
    ;;
  *)
    echo "Usage: extract.sh {vue} {package} {version} "
esac
