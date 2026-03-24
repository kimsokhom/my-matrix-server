terraform {
  required_version = ">= 1.5"
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
  type    = string
  default = "staging"
}

variable "registry" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "registry_username" {
  type = string
}

variable "registry_password" {
  type      = string
  sensitive = true
}

variable "element_image" {
  type    = string
  default = ""
}

module "railway" {
  source = "../../modules/railway"

  railway_token     = var.railway_token
  project_id        = var.project_id
  environment_id    = var.environment_id
  environment       = var.environment
  registry          = var.registry
  image_tag         = var.image_tag
  registry_username = var.registry_username
  registry_password = var.registry_password
  element_image     = var.element_image
}

output "service_ids" {
  value = module.railway.service_ids
}

output "service_names" {
  value = module.railway.service_names
}

output "environment_id" {
  value = module.railway.environment_id
}

output "project_id" {
  value = module.railway.project_id
}

output "service_domains" {
  value     = module.railway.service_domains
  sensitive = true
}
