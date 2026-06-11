#!/bin/bash

REPO="mythrion-dev/mythrion"

issues=(
"Create Campaign entity"
"Create Campaign database schema"
"Create Campaign repository"
"Create Campaign service"
"Create Campaign controller"
"Create Campaign CRUD endpoints"
"Create campaign creation page"
"Create campaign listing page"
"Create campaign details page"
"Create campaign update flow"
"Create campaign delete flow"
"Create campaign invitation system"
"Create campaign member management"
"Create Game Master role"
"Create Player role"
)

for issue in "${issues[@]}"
do
  gh issue create \
    --repo "$REPO" \
    --title "$issue"
done