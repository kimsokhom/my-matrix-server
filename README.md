# Matrix Server Suite — CI/CD & Infrastructure

## Workflow

```
Developer pushes feature-login branch
  → build (only synapse/ changed → only synapse rebuilds)
  → scan  (Trivy scans synapse image — CRITICAL/HIGH blocks pipeline)
  → validate (tofu fmt + validate)
  → plan:branch  → Railway/AWS env: branch-feature-login  (isolated state)
  → deploy:branch

Developer opens MR #3
  → build → scan → validate
  → plan:staging  → Railway/AWS env: staging-mr-3  (state: staging-mr-3)
  → deploy:staging

Developer opens MR #7 (at the same time as MR #3 — no conflict)
  → plan:staging  → Railway/AWS env: staging-mr-7  (state: staging-mr-7)
  → deploy:staging

MR #3 is merged/closed
  → cleanup:staging runs automatically → Railway env staging-mr-3 destroyed
  → OpenTofu state staging-mr-3 cleared

Merge to main
  → build → scan → validate
  → plan:dev  → Railway/AWS env: development
  → deploy:dev
```

## Switching cloud providers

Set `PROVIDER_TYPE` in GitLab CI/CD variables:

| Value | Deploys to |
|---|---|
| `railway` (default) | Railway.app |
| `aws` | AWS ECS Fargate (Singapore) |

That's the only change needed. Service definitions, CI pipeline, secrets — all identical.

## Multiple MRs — how it works

Each MR gets completely isolated infrastructure:

| MR | Railway environment | OpenTofu state key | Destroyed when |
|---|---|---|---|
| MR #3 | `staging-mr-3` | `staging-mr-3` | MR #3 closes/merges |
| MR #7 | `staging-mr-7` | `staging-mr-7` | MR #7 closes/merges |
| branch-fix | `branch-fix` | `branch-fix` | After 3 days or manually |

They never touch each other. Both can deploy simultaneously.

## Structure

```
.gitlab-ci.yml                   ← CI pipeline (change-detected builds, Trivy scanning)
scripts/
  railway-api.sh                 ← Railway GraphQL API helper functions
  deploy.sh                      ← Sets service variables after tofu apply
terraform/
  modules/
    interface/variables.tf       ← The cloud-agnostic service contract
    railway/main.tf              ← Railway implementation
    aws/main.tf                  ← AWS ECS Fargate implementation
  environments/
    dev/main.tf                  ← Picks provider, defines services, runs deployment
    staging/main.tf
    preview/main.tf
    */backend.tf                 ← GitLab HTTP backend (no external state needed)
```

## Required GitLab CI/CD variables

**Infrastructure:**
| Variable | Description |
|---|---|
| `RAILWAY_TOKEN` | Railway account API token |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `RAILWAY_ENVIRONMENT_ID_DEV` | Railway development environment ID |
| `PROVIDER_TYPE` | `railway` or `aws` (default: railway) |
| `ELEMENT_IMAGE` | Element Web image from its own repo |
| `AWS_REGION` | AWS region (default: ap-southeast-1) — only needed if using AWS |

**Application secrets:**
`SERVER_NAME`, `MACAROON_KEY`, `FORM_SECRET`, `REGISTRATION_SHARED_SECRET`,
`MAS_ENCRYPTION_SECRET`, `MAS_SHARED_SECRET`, `MAS_CLIENT_ID`, `MAS_CLIENT_SECRET`,
`MAS_RSA_PRIVATE_KEY`, `ELEMENT_WEB_CLIENT_ID`,
`TELEGRAM_AS_TOKEN`, `TELEGRAM_HS_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`,
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`ADMIN_ACCESS_TOKEN`, `BOT_USER_ID`, `WIDGET_ICON`

## Adding a new service

1. Create `<service>/Dockerfile`
2. Add `build:<service>` and `scan:<service>` jobs in `.gitlab-ci.yml` (copy any existing pair)
3. Add the service to `local.services` in `terraform/environments/dev/main.tf` (and staging, preview)
4. Add variable setup in `scripts/deploy.sh`

## Why variables are set via Railway API, not Terraform

`${{synapse.RAILWAY_PUBLIC_DOMAIN}}` is Railway's cross-service reference syntax.
It only resolves correctly when set through the Railway API.
Terraform stores it as a literal string and Railway never resolves it.
`scripts/deploy.sh` uses `variableCollectionUpsert` after `tofu apply`
so references work correctly at container startup.
