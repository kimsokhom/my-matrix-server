# =============================================================================
# terraform/modules/interface/variables.tf
# =============================================================================
# This is the contract every cloud provider module must accept.
# Define your services once here — Railway, AWS, GCP all receive the same shape.
#
# Think of it like an interface in programming:
#   - You define what a "service" looks like (port, memory, image, etc.)
#   - Each cloud provider module implements that interface in its own way
#   - You switch providers by changing one variable, not by rewriting your services
# =============================================================================

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "matrix"
}

variable "environment" {
  description = "Environment name: dev, staging, preview, production"
  type        = string
}

variable "provider_type" {
  description = "Which cloud provider to deploy to: railway | aws | gcp"
  type        = string
  default     = "railway"

  validation {
    condition     = contains(["railway", "aws", "gcp"], var.provider_type)
    error_message = "provider_type must be one of: railway, aws, gcp"
  }
}

# The service catalog — same shape regardless of cloud provider
variable "services" {
  description = "Map of service name → configuration. Provider modules read this."
  type = map(object({
    image  = string # Full image URL including tag
    port   = number # Port the container listens on
    memory = number # Memory in MB
    cpu    = number # CPU units (1000 = 1 vCPU)
  }))
}

variable "registry_username" { type = string }
variable "registry_password" {
  type      = string
  sensitive = true
}
