terraform {
  required_version = ">= 1.5"
  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6.1"
    }
  }
}

variable "railway_token"     { 
  type = string
 sensitive = true 
 }
variable "project_id"        { type = string }
variable "environment_id"    { type = string }
variable "environment"       { type = string }
variable "registry"          { type = string }
variable "image_tag"         { type = string }
variable "registry_username" { type = string }
variable "registry_password" { 
  type = string

 sensitive = true 
 }
variable "element_image"     {
  type = string
 default = "" 
 }

provider "railway" {
  token = var.railway_token
}

locals {
  # Read services from services.yaml — single source of truth
  config = yamldecode(file("${path.module}/../../services.yaml"))

  services = {
    for name, cfg in local.config.services : name => {
      image = (
        name == "element" && var.element_image != ""
        ? var.element_image
        : "${var.registry}/${name}:${var.image_tag}"
      )
      port   = cfg.port
      memory = cfg.memory
      cpu    = cfg.cpu
    }
  }
}

resource "railway_service" "services" {
  for_each = local.services

  name       = each.key
  project_id = var.project_id

  source_image                   = each.value.image
  source_image_registry_username = var.registry_username
  source_image_registry_password = var.registry_password
}

output "service_ids" {
  value = { for name, svc in railway_service.services : name => svc.id }
}
output "service_names" { value = keys(local.services) }
output "environment_id" { value = var.environment_id }
output "project_id"     { value = var.project_id }
output "provider"       { value = "railway" }
