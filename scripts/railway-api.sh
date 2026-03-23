#!/bin/sh
# =============================================================================
# railway-api.sh — Railway GraphQL API helper
# =============================================================================
set -e

RAILWAY_API="https://backboard.railway.app/graphql/v2"

_gql() {
  RESP=$(curl -sf -X POST "$RAILWAY_API" \
    -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$1")
  if echo "$RESP" | jq -e '.errors' >/dev/null 2>&1; then
    echo "Railway API error:"
    echo "$RESP" | jq -c '.errors'
    exit 1
  fi
  echo "$RESP"
}

# -----------------------------------------------------------------------------
# railway_get_env_id <name>
# Sets RAILWAY_ENV_ID — empty string if not found
# -----------------------------------------------------------------------------
railway_get_env_id() {
  ENV_NAME="$1"
  RAILWAY_ENV_ID=$(_gql "$(jq -nc --arg id "$RAILWAY_PROJECT_ID" \
    '{query:"query($id:String!){project(id:$id){environments{edges{node{id name}}}}}",variables:{id:$id}}')" \
    | jq -r ".data.project.environments.edges[] \
        | select(.node.name==\"${ENV_NAME}\") | .node.id" \
    | head -n1)
  export RAILWAY_ENV_ID
}

# -----------------------------------------------------------------------------
# railway_get_or_create_preview_env <name>
# Creates a DUPLICATE of the dev environment (so all services come with it).
# Sets RAILWAY_ENV_ID.
# -----------------------------------------------------------------------------
railway_get_or_create_preview_env() {
  ENV_NAME="$1"
  SOURCE_ENV_ID="${RAILWAY_ENVIRONMENT_ID_DEV:-}"

  # Check if it already exists
  railway_get_env_id "$ENV_NAME"

  if [ -z "$RAILWAY_ENV_ID" ] || [ "$RAILWAY_ENV_ID" = "null" ]; then
    if [ -z "$SOURCE_ENV_ID" ]; then
      echo "ERROR: RAILWAY_ENVIRONMENT_ID_DEV must be set to create preview environments"
      echo "       Set it to your development environment ID in GitLab CI/CD variables"
      exit 1
    fi

    echo "==> Creating preview environment '${ENV_NAME}' (duplicating dev: ${SOURCE_ENV_ID})"

    # Duplicate the dev environment — this copies all services + their config
    # The new environment starts with staged changes (not yet deployed)
    RAILWAY_ENV_ID=$(_gql "$(jq -nc \
      --arg p "$RAILWAY_PROJECT_ID" \
      --arg n "$ENV_NAME" \
      --arg src "$SOURCE_ENV_ID" \
      '{
        query: "mutation($i:EnvironmentCreateInput!){environmentCreate(input:$i){id name}}",
        variables: {
          i: {
            projectId: $p,
            name: $n,
            sourceEnvironmentId: $src
          }
        }
      }')" | jq -r '.data.environmentCreate.id')

    sleep 5  # Give Railway time to copy the services
    echo "==> Created '${ENV_NAME}' = ${RAILWAY_ENV_ID}"
  else
    echo "==> Found existing environment '${ENV_NAME}' = ${RAILWAY_ENV_ID}"
  fi

  export RAILWAY_ENV_ID
}

# -----------------------------------------------------------------------------
# railway_delete_env <env_id>
# Deletes a Railway environment. Services remain in other environments.
# -----------------------------------------------------------------------------
railway_delete_env() {
  ENV_ID="$1"
  echo "==> Deleting Railway environment: ${ENV_ID}"
  _gql "$(jq -nc --arg id "$ENV_ID" \
    '{query:"mutation($id:String!){environmentDelete(id:$id)}",variables:{id:$id}}')" \
    > /dev/null
  echo "==> Deleted (services still exist in development)"
}

# -----------------------------------------------------------------------------
# railway_get_service_ids
# Fetches all service IDs for the project.
# Sets SERVICE_IDS as JSON: {"synapse": "id", "mas": "id", ...}
# -----------------------------------------------------------------------------
railway_get_service_ids() {
  SERVICE_IDS=$(_gql "$(jq -nc --arg id "$RAILWAY_PROJECT_ID" \
    '{query:"query($id:String!){project(id:$id){services{edges{node{id name}}}}}",variables:{id:$id}}')" \
    | jq '[.data.project.services.edges[].node | {(.name): .id}] | add // {}')
  echo "==> Found $(echo "$SERVICE_IDS" | jq 'keys | length') services in project"
  export SERVICE_IDS
}

# Helper — get a single service ID by name from SERVICE_IDS
_id() {
  echo "$SERVICE_IDS" | jq -r ".\"$1\" // empty"
}

# -----------------------------------------------------------------------------
# railway_update_service_image <env_id> <service_id> <image>
# Updates the Docker image for a service in a specific environment.
# NOTE: Also calls redeploy — Railway requires a separate redeploy trigger
# after updating image source.
# -----------------------------------------------------------------------------
railway_update_service_image() {
  ENV_ID="$1"
  SVC_ID="$2"
  IMAGE="$3"

  echo "==> Image: ${SVC_ID} → ${IMAGE}"

  # Update the image source
  _gql "$(jq -nc \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    --arg img "$IMAGE" \
    '{
      query: "mutation($e:String!,$s:String!,$i:ServiceInstanceUpdateInput!){serviceInstanceUpdate(environmentId:$e,serviceId:$s,input:$i)}",
      variables: { e: $e, s: $s, i: { source: { image: $img } } }
    }')" > /dev/null

  # Trigger redeploy — required, serviceInstanceUpdate alone does not deploy
  _gql "$(jq -nc \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    '{
      query: "mutation($e:String!,$s:String!){serviceInstanceRedeploy(environmentId:$e,serviceId:$s)}",
      variables: { e: $e, s: $s }
    }')" > /dev/null
}

# -----------------------------------------------------------------------------
# railway_upsert_vars <env_id> <service_id> <KEY=VALUE> [<KEY=VALUE> ...]
# Sets variables for a service in a specific environment.
# Existing variables NOT in this list are preserved (replace: false).
# Supports Railway reference syntax: "VAR=\${{other-service.RAILWAY_PUBLIC_DOMAIN}}"
# -----------------------------------------------------------------------------
railway_upsert_vars() {
  ENV_ID="$1"
  SVC_ID="$2"
  shift 2

  VARS_JSON="{}"
  for pair in "$@"; do
    KEY="${pair%%=*}"
    VAL="${pair#*=}"
    VARS_JSON=$(echo "$VARS_JSON" | jq --arg k "$KEY" --arg v "$VAL" '. + {($k): $v}')
  done

  echo "==> Setting $(echo "$VARS_JSON" | jq 'keys | length') variables on service ${SVC_ID}"

  _gql "$(jq -nc \
    --arg p "$RAILWAY_PROJECT_ID" \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    --argjson vars "$VARS_JSON" \
    '{
      query: "mutation($i:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$i)}",
      variables: {
        i: {
          projectId: $p,
          environmentId: $e,
          serviceId: $s,
          variables: $vars,
          replace: false
        }
      }
    }')" > /dev/null

  echo "==> Done"
}
