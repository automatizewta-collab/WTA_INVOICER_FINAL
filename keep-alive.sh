#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting server..."
  bun run dev 2>&1 | tee -a /home/z/my-project/dev.log
  echo "[$(date)] Server exited, restarting in 2s..."
  sleep 2
done
