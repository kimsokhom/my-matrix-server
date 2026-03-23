# =============================================================================
# terraform/modules/aws/main.tf
# =============================================================================
# AWS ECS Fargate implementation of the service interface.
# Receives the exact same services map as the Railway module.
# To switch an environment to AWS: set provider_type = "aws" in that env.
# =============================================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "region"       { 
  type = string
 default = "ap-southeast-1" 
 } # Singapore
variable "project_name" { 
  type = string
 default = "matrix" 
 }
variable "environment"  { type = string }

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

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "OpenTofu"
    }
  }
}

# ── Network ───────────────────────────────────────────────────────────────────

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
}

# ── Registry credentials in Secrets Manager ───────────────────────────────────

resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-exec"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow"
     Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_secretsmanager_secret" "registry" {
  name = "${var.project_name}-${var.environment}-registry"
}

resource "aws_secretsmanager_secret_version" "registry" {
  secret_id     = aws_secretsmanager_secret.registry.id
  secret_string = jsonencode({ username = var.registry_username
   password = var.registry_password })
}

resource "aws_iam_role_policy" "registry_access" {
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow"
     Action = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.registry.arn] }]
  })
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
  setting {
     name = "containerInsights"
   value = "enabled" 
   }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    # Production uses FARGATE (reliable), non-prod uses FARGATE_SPOT (cheaper)
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
    weight            = 1
  }
}

# ── Per-service resources ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "services" {
  for_each          = var.services
  name              = "/ecs/${var.project_name}-${each.key}-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
}

resource "aws_security_group" "services" {
  for_each    = var.services
  name        = "${var.project_name}-${each.key}-${var.environment}"
  vpc_id      = module.vpc.vpc_id
  description = "SG for ${each.key}"

  ingress { 
    from_port = each.value.port
   to_port = each.value.port
    protocol = "tcp"
     cidr_blocks = ["10.0.0.0/16"] 
     }
  egress  {
     from_port = 0
              to_port = 0       
                     protocol = "-1"
                      cidr_blocks = ["0.0.0.0/0"] 
                      }
}

resource "aws_ecs_task_definition" "services" {
  for_each                 = var.services
  family                   = "${var.project_name}-${each.key}-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name  = each.key
    image = each.value.image
    portMappings = [{ containerPort = each.value.port
     protocol = "tcp" }]
    # Variables are set via AWS Systems Manager Parameter Store or passed at runtime
    # The same deploy.sh script sets them via AWS API when provider_type = "aws"
    environment = []
    repositoryCredentials = { credentialsParameter = aws_secretsmanager_secret.registry.arn }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.services[each.key].name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "services" {
  for_each        = var.services
  name            = "${var.project_name}-${each.key}-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
    weight            = 1
  }

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.services[each.key].id]
    assign_public_ip = false
  }

  lifecycle { ignore_changes = [desired_count] }
}

# ── Standardized outputs (same keys as Railway module) ───────────────────────

output "service_ids" {
  description = "Map of service name → ECS service ARN"
  value       = { for name, svc in aws_ecs_service.services : name => svc.id }
}

output "environment_id" { value = var.environment }
output "project_id"     { value = var.project_name }
output "provider"       { value = "aws" }
