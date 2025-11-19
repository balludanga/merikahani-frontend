#!/bin/bash
cd "$(dirname "$0")"
export NODE_OPTIONS=--openssl-legacy-provider
export PORT=3000
npm start
