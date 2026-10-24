#!/bin/sh
set -eu
# Railway mounts a fresh volume as root; application requests run as node.
mkdir -p /app/data
chown -R node:node /app/data
export HOME=/home/node
exec gosu node /app/check-permissions.sh "$@"
