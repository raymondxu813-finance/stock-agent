# 部署操作手册

## 架构概览

```
浏览器
  ├── Vercel CDN (前端页面)
  └── ALB (API 请求, HTTPS)
        └── 私有子网 ECS Fargate
              ├── middleware.ts (API Gateway: 鉴权/CORS/追踪)
              ├── API Routes (业务逻辑)
              ├── RDS PostgreSQL (用户/会话/用量)
              ├── Valkey Redis (会话缓存)
              └── DeepSeek API (LLM 调用, 经 NAT Gateway 出站)
```

## 前置准备

1. AWS 账号，已创建 VPC，含公有/私有子网各 2 个（跨 AZ）
2. RDS PostgreSQL 实例（私有子网），已创建数据库 `multiagent`
3. ElastiCache Valkey 实例（私有子网）
4. ACM 证书（后端域名，如 `api.example.com`）
5. IAM Role: `ecsTaskExecutionRole`（含 ECR pull、Secrets Manager read、CloudWatch Logs 权限）

## 部署步骤

### 1. 创建安全组

```bash
# ALB（公网入站 80/443）
aws ec2 create-security-group --group-name sg-alb --description "ALB" --vpc-id <VPC_ID>
aws ec2 authorize-security-group-ingress --group-id <SG_ALB> --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <SG_ALB> --protocol tcp --port 80 --cidr 0.0.0.0/0

# ECS（仅接受 ALB 流量）
aws ec2 create-security-group --group-name sg-ecs --description "ECS" --vpc-id <VPC_ID>
aws ec2 authorize-security-group-ingress --group-id <SG_ECS> --protocol tcp --port 3000 --source-group <SG_ALB>

# RDS（仅接受 ECS 流量）
aws ec2 authorize-security-group-ingress --group-id <SG_RDS> --protocol tcp --port 5432 --source-group <SG_ECS>

# Valkey（仅接受 ECS 流量）
aws ec2 authorize-security-group-ingress --group-id <SG_VALKEY> --protocol tcp --port 6379 --source-group <SG_ECS>
```

### 2. 创建 ALB 和目标组

```bash
aws elbv2 create-load-balancer \
  --name multiagent-alb \
  --subnets <PUBLIC_SUBNET_A> <PUBLIC_SUBNET_B> \
  --security-groups <SG_ALB> \
  --scheme internet-facing --type application

aws elbv2 create-target-group \
  --name multiagent-tg \
  --protocol HTTP --port 3000 \
  --vpc-id <VPC_ID> --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30

aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=<ACM_CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=<TG_ARN>
```

### 3. 存储密钥到 Secrets Manager

```bash
aws secretsmanager create-secret --name multiagent/jwt-secret --secret-string "<JWT_SECRET>"
aws secretsmanager create-secret --name multiagent/openai-api-keys --secret-string "sk-key1,sk-key2,sk-key3"
```

### 4. 创建 ECR 仓库并推送镜像

```bash
aws ecr create-repository --repository-name multiagent-stock

# 登录 ECR
aws ecr get-login-password --region <REGION> | \
  docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com

# 构建并推送
docker build -t multiagent-stock .
docker tag multiagent-stock:latest <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/multiagent-stock:latest
docker push <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/multiagent-stock:latest
```

### 5. 数据库迁移

```bash
# 在同 VPC 跳板机执行
DATABASE_URL="postgresql://user:pass@<RDS_ENDPOINT>:5432/multiagent" npx prisma migrate deploy
```

### 6. 创建 ECS 集群和服务

```bash
# 创建集群
aws ecs create-cluster --cluster-name multiagent-cluster

# 注册任务定义（修改 task-definition.json 中的占位符后）
aws ecs register-task-definition --cli-input-json file://deploy/task-definition.json

# 创建服务（修改 ecs-service.json 中的占位符后）
aws ecs create-service --cli-input-json file://deploy/ecs-service.json
```

### 7. 配置 DNS

- `api.example.com` CNAME -> ALB DNS 名称
- `app.example.com` CNAME -> Vercel 域名

### 8. Vercel 前端部署

环境变量：
- `NEXT_PUBLIC_API_BASE_URL` = `https://api.example.com`

## 配置文件占位符说明

在 `task-definition.json` 和 `ecs-service.json` 中搜索并替换以下占位符：

| 占位符 | 说明 |
|--------|------|
| `<ACCOUNT_ID>` | AWS 账号 ID |
| `<REGION>` | AWS 区域（如 ap-southeast-1） |
| `<FRONTEND_DOMAIN>` | 前端域名（如 https://app.example.com） |
| `<DB_USER>` / `<DB_PASS>` | RDS 用户名密码 |
| `<RDS_ENDPOINT>` | RDS 内网地址 |
| `<VALKEY_ENDPOINT>` | Valkey 内网地址 |
| `<PRIVATE_SUBNET_A_ID>` / `<PRIVATE_SUBNET_B_ID>` | 私有子网 ID |
| `<SG_ECS_ID>` | ECS 安全组 ID |
| `<TARGET_GROUP_ARN>` | ALB 目标组 ARN |

## 更新部署

```bash
# 构建新镜像
docker build -t multiagent-stock .
docker tag multiagent-stock:latest <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/multiagent-stock:$(date +%Y%m%d%H%M)
docker push <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/multiagent-stock:$(date +%Y%m%d%H%M)

# 更新任务定义中的镜像标签并注册新版本
aws ecs register-task-definition --cli-input-json file://deploy/task-definition.json

# 更新服务（触发滚动部署）
aws ecs update-service --cluster multiagent-cluster --service multiagent-stock-service --force-new-deployment
```

## 验证清单

- [ ] `curl https://api.example.com/api/health` 返回 200
- [ ] 响应中 `database.connected: true`
- [ ] 前端 `https://app.example.com` 正常加载
- [ ] 浏览器 DevTools 无 CORS 错误
- [ ] 注册/登录正常
- [ ] 讨论创建和 Agent 发言流式正常
- [ ] 切换用户后历史记录隔离
- [ ] ECS 任务无公网 IP（`aws ecs describe-tasks` 验证）
