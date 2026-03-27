#!/bin/sh
# =============================================================================
# deploy.sh — Sets Railway variables for all services
# =============================================================================
# Reads terraform/services.yaml — no hardcoding.
# Adding a service to services.yaml is all that's needed here.
#
# DEPLOY_MODE:
#   dev     — reads service IDs from tofu output (services just created)
#   preview — fetches service IDs from Railway API (services already exist)
# =============================================================================

set -e

# Install pyyaml — needed to read services.yaml
pip3 install --quiet --break-system-packages pyyaml 2>/dev/null || \
  apk add --no-cache py3-yaml 2>/dev/null || true

python3 - << 'PYTHON'
import os, sys, json, yaml, urllib.request, urllib.error, subprocess

RAILWAY_API   = "https://backboard.railway.app/graphql/v2"
TOKEN         = os.environ["RAILWAY_TOKEN"]
PROJECT_ID    = os.environ["RAILWAY_PROJECT_ID"]
ENV_ID        = os.environ["RAILWAY_ENV_ID"]
DEPLOY_MODE   = os.environ.get("DEPLOY_MODE", "dev")
IMAGE_TAG     = os.environ.get("IMAGE_TAG", "latest")
REGISTRY      = os.environ.get("REGISTRY", "")
ELEMENT_IMAGE = os.environ.get("ELEMENT_IMAGE", "")
PROJECT_DIR   = os.environ.get("CI_PROJECT_DIR", ".")
SERVICES_YAML = f"{PROJECT_DIR}/terraform/services.yaml"

print(f"\n==> Deploy mode  : {DEPLOY_MODE}")
print(f"==> Environment  : {ENV_ID}")

# ── GraphQL helper ─────────────────────────────────────────────────────────

def gql(query):
    data = json.dumps(query).encode()
    req  = urllib.request.Request(
        RAILWAY_API, data=data,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    if result.get("errors"):
        print(f"GraphQL error: {result['errors']}", file=sys.stderr)
        sys.exit(1)
    return result

# ── Load services.yaml ──────────────────────────────────────────────────────

with open(SERVICES_YAML) as f:
    config = yaml.safe_load(f)
services = config["services"]
print(f"==> {len(services)} services defined in services.yaml")

# ── Get service IDs from Railway project ────────────────────────────────────

result = gql({
    "query": "query($id:String!){project(id:$id){services{edges{node{id name}}}}}",
    "variables": {"id": PROJECT_ID}
})
railway_svcs = {
    n["node"]["name"]: n["node"]["id"]
    for n in result["data"]["project"]["services"]["edges"]
}
print(f"==> {len(railway_svcs)} services found in Railway project")

# ── For dev mode: read service IDs from tofu output ─────────────────────────

if DEPLOY_MODE == "dev":
    try:
        result_raw = subprocess.run(
            ["tofu", "output", "-json", "service_ids"],
            capture_output=True, text=True, check=True
        )
        tofu_ids = json.loads(result_raw.stdout)
        # Merge tofu IDs with railway IDs (tofu is authoritative for dev)
        railway_svcs.update(tofu_ids)
        print(f"==> Updated service IDs from tofu output")
    except Exception as e:
        print(f"  Note: Could not read tofu output ({e}) — using Railway API IDs")

# ── Update images for preview environments ───────────────────────────────────

if DEPLOY_MODE == "preview":
    print(f"\n==> Updating service images → :{IMAGE_TAG}")
    for name in services:
        svc_id = railway_svcs.get(name)
        if not svc_id:
            print(f"  SKIP '{name}' — not in Railway project yet")
            continue

        img = ELEMENT_IMAGE if (name == "element" and ELEMENT_IMAGE) \
              else f"{REGISTRY}/{name}:{IMAGE_TAG}"
        print(f"  {name} → {img}")

        gql({"query": "mutation($e:String!,$s:String!,$i:ServiceInstanceUpdateInput!){serviceInstanceUpdate(environmentId:$e,serviceId:$s,input:$i)}",
             "variables": {"e": ENV_ID, "s": svc_id, "i": {"source": {"image": img}}}})
        gql({"query": "mutation($e:String!,$s:String!){serviceInstanceRedeploy(environmentId:$e,serviceId:$s)}",
             "variables": {"e": ENV_ID, "s": svc_id}})

# ── Set variables for every service ─────────────────────────────────────────

print("\n==> Setting variables for all services...")
all_ok = True

for name, cfg in services.items():
    svc_id = railway_svcs.get(name)
    if not svc_id:
        print(f"  SKIP '{name}' — not in Railway project")
        continue

    variables = {}

    # Static env_vars from services.yaml
    for k, v in (cfg.get("env_vars") or {}).items():
        variables[k] = str(v)

    # Secrets — matched to GitLab CI environment variables
    missing = []
    for secret in (cfg.get("secrets") or []):
        val = os.environ.get(secret, "")
        if not val:
            missing.append(secret)
        variables[secret] = val

    if missing:
        print(f"  WARNING [{name}]: not set in GitLab CI: {', '.join(missing)}")
        all_ok = False

    if not variables:
        print(f"  {name}: nothing to set")
        continue

    print(f"  {name}: {len(variables)} variables")

    gql({
        "query": "mutation($i:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$i)}",
        "variables": {"i": {
            "projectId":     PROJECT_ID,
            "environmentId": ENV_ID,
            "serviceId":     svc_id,
            "variables":     variables,
            "replace":       False
        }}
    })

print()
if all_ok:
    print("✅  All variables set successfully.")
else:
    print("⚠️   Done with warnings — some secrets were not set (see above).")
print("    Railway resolves ${{service.VAR}} references at container startup.")
PYTHON
