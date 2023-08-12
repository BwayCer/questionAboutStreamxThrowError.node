#!/usr/bin/env bash

set -e

argA="$1"

__filename=`realpath "$0"`
_dirsh=`dirname "$__filename"`


pugPackageCode='{
  "type": "module",
  "dependencies": {
    "pug": "3.0.2"
  }
}'

if [ ! -e "$_dirsh/runTryCatch/node_modules" ]; then
  cd "$_dirsh/runTryCatch"
  npm i
  rm package-lock.json
fi

if [ ! -e "$_dirsh/runRollupNodeResolve/node_modules" ]; then
  cd "$_dirsh/runRollupNodeResolve"
  npm i
  rm package-lock.json

  [ -e "$_dirsh/runRollupNodeResolveWithPug" ] \
    && rm -rf "$_dirsh/runRollupNodeResolveWithPug" \
    || :
  cp -r "$_dirsh/runRollupNodeResolve" "$_dirsh/runRollupNodeResolveWithPug"
  cd "$_dirsh/runRollupNodeResolveWithPug"
  mkdir -p pug/theModules
  cd pug
  echo "$pugPackageCode" > "package.json"
  npm i
  mv node_modules/resolve theModules/
  mv node_modules/@babel  theModules/
  rm -rf node_modules
  rm package-lock.json
fi

