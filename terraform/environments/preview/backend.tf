terraform {
  backend "http" {
    # Configured by CI via -backend-config flags.
    # State key is set per environment: dev, staging-mr-N, branch-<slug>
  }
}
