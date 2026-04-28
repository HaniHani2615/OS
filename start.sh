#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/web"
echo "Đang cài dependencies..."
npm install
echo "Khởi động server tại http://localhost:3005"
npm run dev
