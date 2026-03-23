#!/bin/sh
# =============================================================================
# railway-api.sh
# =============================================================================
# Single helper for all Railway GraphQL API operations.
# Source this file, then call the functions you need.
#
# Required env vars:
#   RAILWAY_TOKEN      — Railway account API token
#   RAILWAY_PROJECT_ID — Railway project ID
#
# Usage:
#   source /scripts/railway-api.sh
#   railway_get_or_create_env "pr-42"   # returns env ID in RAILWAY_ENV_ID
#   railway_upsert_vars "$ENV_ID" "$SERVICE_ID" "VAR1=val1" "VAR2=val2"
#   railway_delete_env "$ENV_ID"
# =============================================================================

set -e

RAILWAY_API="https://backboard.railway.app/graphql/v2"

# -----------------------------------------------------------------------------
# _gql <query_json>
# Makes a GraphQL request. Returns the full JSON response.
# Exits with error if the response contains errors.
# -----------------------------------------------------------------------------
_gql() {
  RESPONSE=$(curl -sf -X POST "$RAILWAY_API" \
    -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$1")

  if echo "$RESPONSE" | jq -e '.errors' >/dev/null 2>&1; then
    echo "Railway API error:"
    echo "$RESPONSE" | jq -c '.errors'
    exit 1
  fi

  echo "$RESPONSE"
}

# -----------------------------------------------------------------------------
# railway_get_env_id <name>
# Sets RAILWAY_ENV_ID to the ID of the environment with the given name,
# or empty string if not found.
# -----------------------------------------------------------------------------
railway_get_env_id() {
  ENV_NAME="$1"
  QUERY=$(jq -nc --arg id "$RAILWAY_PROJECT_ID" '{
    query: "query($id:String!){ project(id:$id){ environments{ edges{ node{ id name } } } } }",
    variables: { id: $id }
  }')

  RAILWAY_ENV_ID=$(_gql "$QUERY" \
    | jq -r ".data.project.environments.edges[] | select(.node.name==\"${ENV_NAME}\") | .node.id" \
    | head -n1)

  export RAILWAY_ENV_ID
}

# -----------------------------------------------------------------------------
# railway_create_env <name>
# Creates a Railway environment. Sets RAILWAY_ENV_ID to the new env's ID.
# -----------------------------------------------------------------------------
railway_create_env() {
  ENV_NAME="$1"
  echo "==> Creating Railway environment: ${ENV_NAME}"

  QUERY=$(jq -nc --arg p "$RAILWAY_PROJECT_ID" --arg n "$ENV_NAME" '{
    query: "mutation($i:EnvironmentCreateInput!){ environmentCreate(input:$i){ id name } }",
    variables: { i: { projectId: $p, name: $n } }
  }')

  RAILWAY_ENV_ID=$(_gql "$QUERY" | jq -r '.data.environmentCreate.id')
  echo "==> Created environment '${ENV_NAME}' → ${RAILWAY_ENV_ID}"
  export RAILWAY_ENV_ID
}

# -----------------------------------------------------------------------------
# railway_get_or_create_env <name>
# Gets existing env or creates it. Always sets RAILWAY_ENV_ID.
# -----------------------------------------------------------------------------
railway_get_or_create_env() {
  ENV_NAME="$1"
  railway_get_env_id "$ENV_NAME"

  if [ -z "$RAILWAY_ENV_ID" ] || [ "$RAILWAY_ENV_ID" = "null" ]; then
    railway_create_env "$ENV_NAME"
    sleep 3  # give Railway a moment to propagate the new env
  else
    echo "==> Found existing environment '${ENV_NAME}' → ${RAILWAY_ENV_ID}"
  fi
}

# -----------------------------------------------------------------------------
# railway_delete_env <env_id>
# Deletes a Railway environment and all its deployments.
# -----------------------------------------------------------------------------
railway_delete_env() {
  ENV_ID="$1"
  echo "==> Deleting Railway environment: ${ENV_ID}"

  QUERY=$(jq -nc --arg id "$ENV_ID" '{
    query: "mutation($id:String!){ environmentDelete(id:$id) }",
    variables: { id: $id }
  }')

  _gql "$QUERY" > /dev/null
  echo "==> Deleted environment ${ENV_ID}"
}

# -----------------------------------------------------------------------------
# railway_get_service_id <env_id> <service_name>
# Sets RAILWAY_SERVICE_ID to the service's ID in the given environment,
# or empty string if not found.
# -----------------------------------------------------------------------------
railway_get_service_id() {
  ENV_ID="$1"
  SVC_NAME="$2"

  QUERY=$(jq -nc --arg id "$RAILWAY_PROJECT_ID" '{
    query: "query($id:String!){ project(id:$id){ services{ edges{ node{ id name } } } } }",
    variables: { id: $id }
  }')

  RAILWAY_SERVICE_ID=$(_gql "$QUERY" \
    | jq -r ".data.project.services.edges[] | select(.node.name==\"${SVC_NAME}\") | .node.id" \
    | head -n1)

  export RAILWAY_SERVICE_ID
}

# -----------------------------------------------------------------------------
# railway_create_service <env_id> <name> <image>
# Creates a service in the given environment with a Docker image source.
# Sets RAILWAY_SERVICE_ID to the new service's ID.
# -----------------------------------------------------------------------------
railway_create_service() {
  ENV_ID="$1"
  SVC_NAME="$2"
  IMAGE="$3"

  echo "==> Creating service '${SVC_NAME}' with image ${IMAGE}"

  QUERY=$(jq -nc \
    --arg p "$RAILWAY_PROJECT_ID" \
    --arg n "$SVC_NAME" \
    '{
      query: "mutation($i:ServiceCreateInput!){ serviceCreate(input:$i){ id name } }",
      variables: { i: { projectId: $p, name: $n } }
    }')

  RAILWAY_SERVICE_ID=$(_gql "$QUERY" | jq -r '.data.serviceCreate.id')
  echo "==> Created service '${SVC_NAME}' → ${RAILWAY_SERVICE_ID}"

  # Connect the image source (separate call — triggers first deploy)
  railway_update_service_image "$ENV_ID" "$RAILWAY_SERVICE_ID" "$IMAGE"

  export RAILWAY_SERVICE_ID
}

# -----------------------------------------------------------------------------
# railway_get_or_create_service <env_id> <name> <image>
# Gets existing service or creates it. Always sets RAILWAY_SERVICE_ID.
# -----------------------------------------------------------------------------
railway_get_or_create_service() {
  ENV_ID="$1"
  SVC_NAME="$2"
  IMAGE="$3"

  railway_get_service_id "$ENV_ID" "$SVC_NAME"

  if [ -z "$RAILWAY_SERVICE_ID" ] || [ "$RAILWAY_SERVICE_ID" = "null" ]; then
    railway_create_service "$ENV_ID" "$SVC_NAME" "$IMAGE"
  else
    echo "==> Found existing service '${SVC_NAME}' → ${RAILWAY_SERVICE_ID}"
    # Update image to the new tag
    railway_update_service_image "$ENV_ID" "$RAILWAY_SERVICE_ID" "$IMAGE"
  fi
}

# -----------------------------------------------------------------------------
# railway_update_service_image <env_id> <service_id> <image>
# Updates the Docker image source for a service instance.
# Uses serviceInstanceUpdate with the image source.
# -----------------------------------------------------------------------------
railway_update_service_image() {
  ENV_ID="$1"
  SVC_ID="$2"
  IMAGE="$3"

  echo "==> Updating service ${SVC_ID} image → ${IMAGE}"

  QUERY=$(jq -nc \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    --arg img "$IMAGE" \
    '{
      query: "mutation($i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(input:$i) }",
      variables: {
        i: {
          environmentId: $e,
          serviceId: $s,
          source: { image: $img }
        }
      }
    }')

  _gql "$QUERY" > /dev/null
}

# -----------------------------------------------------------------------------
# railway_upsert_vars <env_id> <service_id> <key=value> [<key=value> ...]
# Sets multiple variables for a service in one API call.
# Uses replace:false so existing vars not in the list are preserved.
#
# Supports Railway reference syntax: "MY_VAR=\${{other-service.SOME_VAR}}"
# These are stored as-is and Railway resolves them at runtime.
# -----------------------------------------------------------------------------
railway_upsert_vars() {
  ENV_ID="$1"
  SVC_ID="$2"
  shift 2

  # Build the variables JSON object from key=value arguments
  VARS_JSON="{}"
  for pair in "$@"; do
    KEY="${pair%%=*}"
    VAL="${pair#*=}"
    VARS_JSON=$(echo "$VARS_JSON" | jq --arg k "$KEY" --arg v "$VAL" '. + {($k): $v}')
  done

  echo "==> Upserting $(echo "$VARS_JSON" | jq 'keys | length') variables for service ${SVC_ID}"

  QUERY=$(jq -nc \
    --arg p "$RAILWAY_PROJECT_ID" \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    --argjson vars "$VARS_JSON" \
    '{
      query: "mutation($i:VariableCollectionUpsertInput!){ variableCollectionUpsert(input:$i) }",
      variables: {
        i: {
          projectId: $p,
          environmentId: $e,
          serviceId: $s,
          variables: $vars,
          replace: false
        }
      }
    }')

  _gql "$QUERY" > /dev/null
  echo "==> Variables set"
}

# -----------------------------------------------------------------------------
# railway_redeploy <env_id> <service_id>
# Triggers a new deployment for a service.
# -----------------------------------------------------------------------------
railway_redeploy() {
  ENV_ID="$1"
  SVC_ID="$2"

  echo "==> Triggering redeploy for service ${SVC_ID}"

  QUERY=$(jq -nc \
    --arg e "$ENV_ID" \
    --arg s "$SVC_ID" \
    '{
      query: "mutation($i:ServiceInstanceDeployInput!){ serviceInstanceDeploy(input:$i) }",
      variables: { i: { environmentId: $e, serviceId: $s } }
    }')

  _gql "$QUERY" > /dev/null
  echo "==> Redeploy triggered"
}