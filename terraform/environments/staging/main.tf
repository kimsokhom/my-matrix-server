# =============================================================================
# environments/dev/main.tf  (same file used for staging and preview too)
# =============================================================================
# TO SWITCH CLOUD PROVIDER:
#   Set provider_type = "aws" (or "railway") in GitLab CI/CD variables.
#   Everything else — services, images, secrets — stays identical.
# =============================================================================

terraform {
  required_version = ">= 1.5"
}

# ── Variables ─────────────────────────────────────────────────────────────────

variable "provider_type" {
  description = "Cloud provider: railway | aws"
  type        = string
  default     = "railway"
}

variable "environment" {
  type    = string
  default = "staging"
}

# Railway-specific
variable "railway_token"    { 
  type = string
  sensitive = true
  default = "" 
  }
variable "project_id"       { 
  type = string
  default = "" 
  }
variable "environment_id"   { 
  type = string
  default = "" 
}

# AWS-specific
variable "aws_region"     { 
    type = string
   default = "ap-southeast-1" 
   }
variable "project_name"   { 
  type = string
 default = "matrix" 
 }

# Registry (same for all providers)
variable "registry"          { type = string }
variable "registry_username" { type = string }
variable "registry_password" { 
  type = string
 sensitive = true 
 }

# Image tag — set by CI (commit SHA, branch-slug, etc.)
variable "image_tag" { 
  type = string
 default = "latest" 
 }

# Element Web image comes from its own repo
variable "element_image" {
  type    = string
  default = "vectorim/element-web:latest"
}

# ── Service catalog ───────────────────────────────────────────────────────────
# Define ALL services once. Both Railway and AWS modules receive this map.
# To add a service: add it here + add build/scan jobs in .gitlab-ci.yml

locals {
  services = {
    synapse = {
      image  = "${var.registry}/synapse:${var.image_tag}"
      port   = 8008
      memory = 2048
      cpu    = 1000
    }
    mas = {
      image  = "${var.registry}/mas:${var.image_tag}"
      port   = 8008
      memory = 1024
      cpu    = 500
    }
    element = {
      # From element-web's own repo — controlled by ELEMENT_IMAGE CI variable
      image  = var.element_image
      port   = 80
      memory = 512
      cpu    = 250
    }
    element-call = {
      image  = "${var.registry}/element-call:${var.image_tag}"
      port   = 80
      memory = 512
      cpu    = 250
    }
    nginx = {
      image  = "${var.registry}/nginx:${var.image_tag}"
      port   = 80
      memory = 256
      cpu    = 125
    }
    telegram = {
      image  = "${var.registry}/telegram:${var.image_tag}"
      port   = 29317
      memory = 512
      cpu    = 250
    }
    provisioning-service = {
      image  = "${var.registry}/provisioning-service:${var.image_tag}"
      port   = 3000
      memory = 512
      cpu    = 250
    }
    postmoogle-widget = {
      image  = "${var.registry}/postmoogle-widget:${var.image_tag}"
      port   = 3000
      memory = 256
      cpu    = 125
    }
  }
}

# ── Railway deployment ────────────────────────────────────────────────────────

module "railway" {
  count  = var.provider_type == "railway" ? 1 : 0
  source = "../../modules/railway"

  railway_token     = var.railway_token
  project_id        = var.project_id
  environment_id    = var.environment_id
  environment       = var.environment
  services          = local.services
  registry_username = var.registry_username
  registry_password = var.registry_password
}

# ── AWS deployment ────────────────────────────────────────────────────────────

module "aws" {
  count  = var.provider_type == "aws" ? 1 : 0
  source = "../../modules/aws"

  region        = var.aws_region
  project_name  = var.project_name
  environment   = var.environment
  services      = local.services
  registry_username = var.registry_username
  registry_password = var.registry_password
}

# ── Unified outputs ───────────────────────────────────────────────────────────
# Same output shape regardless of which provider was used.
# deploy.sh reads these without needing to know which cloud it's on.

output "service_ids" {
  value = var.provider_type == "railway" ? (
    length(module.railway) > 0 ? module.railway[0].service_ids : {}
  ) : (
    length(module.aws) > 0 ? module.aws[0].service_ids : {}
  )
}

output "environment_id" {
  value = var.provider_type == "railway" ? (
    length(module.railway) > 0 ? module.railway[0].environment_id : ""
  ) : var.environment
}

output "provider_type" {
  value = var.provider_type
}
