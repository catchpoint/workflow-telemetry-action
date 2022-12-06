#!/bin/bash -e

if [[ "$(git status --porcelain)" != "" ]]; then
    echo ----------------------------------------
    echo git status
    echo ----------------------------------------
    git status

    echo ----------------------------------------
    echo git diff
    echo ----------------------------------------
    git --no-pager diff

    echo ----------------------------------------
    echo Troubleshooting
    echo ----------------------------------------
    echo "::error::Unstaged changes detected. Locally try running: npm run all"

    exit 1
fi
