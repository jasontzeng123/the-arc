#!/bin/sh
# Regenerate app/src/scenes/_registry.ts from the scene files that exist.
cd "$(dirname "$0")/../app/src/scenes" || exit 1
{
  for f in stone bow metal powder guns wars modern arsenal blast finale; do [ -f $f.ts ] && echo "import $f from './$f';"; done
  echo "import type { SceneClass } from '../engine/scene';"
  printf "export const REG: Record<string, SceneClass> = {"
  for f in stone bow metal powder guns wars modern arsenal blast finale; do [ -f $f.ts ] && printf " $f: $f as any,"; done
  echo " };"
} > _registry.ts
