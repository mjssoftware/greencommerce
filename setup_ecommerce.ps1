# የፕሮጀክቱን ዋና ፎልደር መፍጠር
$ROOT_DIR = "ecommerce-backend"
Write-Host "Creating root directory: $ROOT_DIR..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $ROOT_DIR | Out-Null
Set-Location $ROOT_DIR

# ፎልደሮችን በቀላሉ ለመፍጠር የሚያግዝ ፈንክሽን
function Create-DirStructure {
    param([string[]]$Paths)
    foreach ($path in $Paths) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

# ፋይሎችን በቀላሉ ለመፍጠር የሚያግዝ ፈንክሽን
function Create-Files {
    param([string[]]$Files)
    foreach ($file in $Files) {
        if (-not (Test-Path $file)) {
            New-Item -ItemType File -Force -Path $file | Out-Null
        }
    }
}

# 1. API GATEWAY ፎልደር እና ፋይሎች
Write-Host "Creating API Gateway..." -ForegroundColor Cyan
Create-DirStructure @(
    "api-gateway/src/config",
    "api-gateway/src/middleware",
    "api-gateway/src/routes/v1",
    "api-gateway/src/utils"
)

Create-Files @(
    "api-gateway/src/config/gateway.config.js",
    "api-gateway/src/config/routes.config.js",
    "api-gateway/src/config/plugins.config.js",
    "api-gateway/src/middleware/auth.js",
    "api-gateway/src/middleware/rate-limiter.js",
    "api-gateway/src/middleware/logging.js",
    "api-gateway/src/middleware/error-handler.js",
    "api-gateway/src/routes/v1/auth.routes.js",
    "api-gateway/src/routes/v1/product.routes.js",
    "api-gateway/src/routes/v1/order.routes.js",
    "api-gateway/src/routes/v1/cart.routes.js",
    "api-gateway/src/routes/v1/payment.routes.js",
    "api-gateway/src/routes/v1/inventory.routes.js",
    "api-gateway/src/routes/v1/notification.routes.js",
    "api-gateway/src/routes/v1/review.routes.js",
    "api-gateway/src/routes/index.js",
    "api-gateway/src/utils/logger.js",
    "api-gateway/src/utils/jwt-helper.js",
    "api-gateway/src/app.js",
    "api-gateway/.env",
    "api-gateway/.env.example",
    "api-gateway/Dockerfile",
    "api-gateway/ecosystem.config.js"
)

# 2. MICROSERVICES ፎልደሮች
$services = @(
    "identity-auth-service",
    "product-catalog-service",
    "order-service",
    "cart-basket-service",
    "payment-service",
    "inventory-stock-service",
    "notification-service",
    "review-rating-service"
)

foreach ($service in $services) {
    Write-Host "Creating Service: $service..." -ForegroundColor Cyan
    
    # መሠረታዊ የሆኑትን የውስጥ ፎልደሮች መፍጠር
    Create-DirStructure @(
        "services/$service/src/config",
        "services/$service/src/controllers",
        "services/$service/src/models",
        "services/$service/src/services",
        "services/$service/src/middleware",
        "services/$service/src/validations",
        "services/$service/src/utils",
        "services/$service/src/repositories",
        "services/$service/src/routes/v1",
        "services/$service/tests"
    )

    # ፋይሎችን መፍጠር
    Create-Files @(
        "services/$service/src/app.js",
        "services/$service/.env",
        "services/$service/Dockerfile",
        "services/$service/ecosystem.config.js"
    )
}

# ለእያንዳንዱ ሰርቪስ የተለዩ ተጨማሪ ፋይሎችን ማሟላት
Create-Files @("services/identity-auth-service/src/config/database.js", "services/identity-auth-service/src/config/redis.js", "services/identity-auth-service/src/config/rabbitmq.js", "services/identity-auth-service/src/config/jwt.js")
Create-Files @("services/identity-auth-service/src/controllers/auth.controller.js", "services/identity-auth-service/src/controllers/user.controller.js", "services/identity-auth-service/src/controllers/role.controller.js")
Create-Files @("services/identity-auth-service/src/models/User.model.js", "services/identity-auth-service/src/models/Role.model.js", "services/identity-auth-service/src/models/RefreshToken.model.js")

Create-Files @("services/product-catalog-service/src/models/Product.model.js", "services/product-catalog-service/src/models/Category.model.js")
Create-Files @("services/order-service/src/models/Order.model.js", "services/order-service/src/services/saga-orchestrator.service.js")
Create-Files @("services/cart-basket-service/src/config/redis.js")
Create-Files @("services/payment-service/src/config/stripe.js")
Create-Files @("services/inventory-stock-service/src/services/stock-reservation.service.js")
Create-DirStructure @("services/notification-service/src/templates/email", "services/notification-service/src/templates/sms")
Create-Files @("services/notification-service/src/templates/email/welcome.hbs", "services/notification-service/src/templates/sms/templates.json")

# 3. MESSAGE BROKER
Write-Host "Creating Message Broker..." -ForegroundColor Cyan
Create-DirStructure @("message-broker/event-schemas")
Create-Files @(
    "message-broker/docker-compose.rabbitmq.yml",
    "message-broker/rabbitmq.config.js",
    "message-broker/event-schemas/user.events.json",
    "message-broker/event-schemas/order.events.json",
    "message-broker/event-schemas/payment.events.json",
    "message-broker/event-schemas/inventory.events.json"
)

# 4. SHARED LIBRARIES
Write-Host "Creating Shared Libraries..." -ForegroundColor Cyan
Create-DirStructure @(
    "shared/libs/logger",
    "shared/libs/message-queue",
    "shared/libs/database",
    "shared/libs/redis",
    "shared/libs/utils",
    "shared/types",
    "shared/constants"
)
Create-Files @(
    "shared/libs/logger/index.js",
    "shared/libs/message-queue/rabbitmq-client.js",
    "shared/libs/message-queue/kafka-client.js",
    "shared/libs/database/mongodb.js",
    "shared/libs/database/postgres.js",
    "shared/libs/redis/client.js",
    "shared/libs/utils/jwt.js",
    "shared/constants/events.js",
    "shared/constants/status-codes.js"
)

# 5. ROOT FILES
Write-Host "Creating Root files..." -ForegroundColor Cyan
Create-DirStructure @("kubernetes/deployments", "kubernetes/services", "kubernetes/configmaps", "scripts")
Create-Files @(
    "kubernetes/ingress.yaml",
    "scripts/setup.sh",
    "scripts/seed-data.js",
    "scripts/health-check.sh",
    "docker-compose.yml",
    "docker-compose.override.yml",
    ".env",
    ".gitignore",
    "README.md"
)

# 6. NODE.JS PACKAGE.JSON ፋይሎችን በውስጡ መጻፍ (እዚህ ላይ ነው የተስተካከለው)
Write-Host "Writing package.json files for Node.js..." -ForegroundColor Cyan

# Root package.json
$rootPackage = '{ "name": "ecommerce-backend-root", "version": "1.0.0", "private": true, "scripts": { "start": "docker-compose up" } }'
Set-Content -Path "package.json" -Value $rootPackage

# API Gateway package.json
$gatewayPackage = '{ "name": "api-gateway", "version": "1.0.0", "main": "src/app.js", "scripts": { "start": "node src/app.js", "dev": "nodemon src/app.js" }, "dependencies": { "express": "^4.19.2", "dotenv": "^16.4.5", "cors": "^2.8.5" } }'
Set-Content -Path "api-gateway/package.json" -Value $gatewayPackage

# Services package.json
foreach ($service in $services) {
    # PowerShell እርስ በርሱ እንዳይጋጭ እያንዳንዱን JSON ንብረት በነጠላ ጥቅስ (Single Quote) ከበን እናስቀምጠዋለን
    $servicePackage = '{
        "name": "' + $service + '",
        "version": "1.0.0",
        "main": "src/app.js",
        "scripts": {
            "start": "node src/app.js",
            "dev": "nodemon src/app.js"
        },
        "dependencies": {
            "express": "^4.19.2",
            "dotenv": "^16.4.5"
        }
    }'
    Set-Content -Path "services/$service/package.json" -Value $servicePackage
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "ሁሉንም ፎልደሮች፣ የ Node.js package.json እና ፋይሎች በዊንዶውስህ ላይ በተሳካ ሁኔታ ተፈጥረዋል!" -ForegroundColor Green
Write-Host "እባክህ ፎልደሩን በ VS Code ከፍተህ እየው።" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green