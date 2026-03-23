# =============================================================================
# terraform/modules/railway/main.tf
# =============================================================================
# Railway implementation of the service interface.
# Receives the same services map as any other provider module.
# Creates Railway services + sets the image source.
# Variables are set separately via Railway API (scripts/deploy.sh).
# =============================================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6.1"
    }
  }
}

variable "railway_token" {
  type      = string
  sensitive = true
}

variable "project_id" {
  type = string
}

variable "environment_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "services" {
  type = map(object({
    image  = string
    port   = number
    memory = number
    cpu    = number
  }))
}

variable "registry_username" { type = string }
variable "registry_password" {
  type = string
  sensitive = true
}

provider "railway" {
  token = var.railway_token
}

resource "railway_service" "services" {
  for_each = var.services

  name       = each.key
  project_id = var.project_id

  source_image                   = each.value.image
  source_image_registry_username = var.registry_username
  source_image_registry_password = var.registry_password
}

# ── Outputs ───────────────────────────────────────────────────────────────────
# Standardized output shape — same keys regardless of which provider module is used

output "service_ids" {
  description = "Map of service name → provider-specific service ID"
  value       = { for name, svc in railway_service.services : name => svc.id }
}

output "environment_id" {
  value = var.environment_id
}

output "project_id" {
  value = var.project_id
}

output "provider" {
  value = "railway"
}
