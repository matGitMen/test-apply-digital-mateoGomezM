# Product Management API

A NestJS-based REST API for managing products with data synchronization from Contentful CMS, Redis caching, and comprehensive reporting capabilities.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Configuration](#database-configuration)
- [Initial Data Refresh](#initial-data-refresh)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Assumptions](#assumptions)
- [AI Usage Disclosure](#ai-usage-disclosure)

## Features

### Public API
- **Product Management**: CRUD operations with pagination and filtering
- **Soft Delete**: Products are soft-deleted, not permanently removed
- **Redis Caching**: Product queries are cached for 1 hour for improved performance
- **Data Synchronization**: Automatic hourly sync from Contentful CMS

### Private API (JWT Protected)
- **Deleted Products Report**: Percentage of deleted vs total products
- **Non-Deleted Products Report**: Percentage with optional filters (price, date range)
- **Products by Category Report**: Distribution of products across categories

## Tech Stack

- **Framework**: NestJS 11.x
- **Database**: PostgreSQL 13
- **ORM**: TypeORM
- **Cache**: Redis (Alpine)
- **External API**: Contentful CMS
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest

## Prerequisites

- **Docker Desktop**: Must be installed and running
- **Node.js**: 18.x or higher (for local development)
- **npm**: 9.x or higher

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd test-apply-digital
   ```

2. **Install dependencies** (optional, for local development):
   ```bash
   npm install
   ```

## Database Configuration

The application uses PostgreSQL running in Docker. Configuration is managed through environment variables in `docker-compose.yml`:

```yaml
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=products
```

### Database Schema

The database schema is automatically created by TypeORM using the `synchronize: true` option. The main table is:

**products**:
- `id`: Primary key (UUID, auto-generated)
- `contentfulId`: Unique identifier from Contentful
- `sku`, `name`, `brand`, `model`, `category`, `color`: Product attributes
- `price`, `currency`, `stock`: Pricing and inventory
- `createdAt`, `updatedAt`: Timestamps
- `deletedAt`: Soft delete timestamp (nullable)

### Data Persistence

Data is persisted using Docker volumes:
- `postgres_data`: Stores all PostgreSQL data
- Data survives container restarts (`docker-compose down`)
- Data is deleted only with `docker-compose down -v`

## Initial Data Refresh

### Automatic Sync (Recommended)

The application includes a Docker-based cron service that automatically syncs data from Contentful **every hour**.

### Manual Sync

To manually trigger a data refresh:

```bash
curl -X POST http://localhost:3000/products/sync
```

This endpoint:
1. Fetches all products from Contentful API
2. Upserts them into PostgreSQL (based on `contentfulId`)
3. Invalidates the Redis cache

## Running the Application

### Using Docker (Recommended)

1. **Start all services**:
   ```bash
   docker-compose up --build
   ```

   This starts:
   - NestJS API (port 3000)
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - Cron service (for automatic sync)

2. **Stop services**:
   ```bash
   docker-compose down
   ```

3. **Reset everything** (including data):
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

### Development Mode

The Docker setup includes **hot-reloading**. Any code changes will automatically restart the application inside the container.

### Local Development (Without Docker)

1. Ensure PostgreSQL and Redis are running locally
2. Update environment variables in `.env` file
3. Run:
   ```bash
   npm run start:dev
   ```

## API Documentation

### Swagger UI

Once the application is running, access the interactive API documentation at:

**http://localhost:3000/api/docs**

### Endpoints

#### Public Endpoints

- `GET /products` - List products (paginated, filterable)
  - Query params: `page`, `limit`, `name`, `category`, `minPrice`, `maxPrice`
- `DELETE /products/:id` - Soft delete a product
- `POST /products/sync` - Manually trigger Contentful sync

#### Private Endpoints (Require `Authorization: Bearer <token>`)

- `GET /reports/deleted-percentage` - Deleted products report
- `GET /reports/non-deleted-percentage` - Non-deleted products report
  - Query params: `withPrice`, `startDate`, `endDate`
- `GET /reports/products-by-category` - Products by category report

### Example Requests

```bash
# Get products
curl "http://localhost:3000/products?page=1&limit=5&category=Tools"

# Delete product (use UUID from GET response)
curl -X DELETE "http://localhost:3000/products/7e35aa47-0dc6-42d1-a158-4703987e1ce7"

# Get report (with auth)
curl -H "Authorization: Bearer test_token" \
  "http://localhost:3000/reports/products-by-category"
```

## Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run E2E Tests

```bash
npm run test:e2e
```

**Note**: E2E tests require the Docker environment to be running.

## Project Structure

```
src/
├── products/              # Product module (renamed from publicModule)
│   ├── controllers/       # REST controllers
│   ├── providers/
│   │   └── products/
│   │       ├── adapters/  # Contentful adapter (Adapter pattern)
│   │       ├── dto/       # Data Transfer Objects
│   │       ├── entity/    # TypeORM entities
│   │       ├── interfaces/# Service interfaces
│   │       ├── module/    # Product module definition
│   │       └── provider/  # Product service
├── reports/               # Private reporting module
│   ├── controllers/       # Report controllers (JWT protected)
│   └── strategies/        # Report strategies (Strategy pattern)
├── common/
│   └── guards/            # Auth guard
├── config/                # Configuration services
│   └── services/          # DB config service
├── app.module.ts          # Root module
└── main.ts                # Application entry point

cron/                      # Docker cron service
├── Dockerfile
└── crontab                # Cron schedule
```

## Assumptions

1. **Authentication**: The JWT guard performs a basic token format check (`Bearer <token>`). Full JWT validation is not implemented as it was not required for the test scope.

2. **Contentful Schema**: The adapter assumes Contentful products have the following fields:
   - `sku`, `name`, `brand`, `model`, `category`, `color`
   - `price`, `currency`, `stock`
   - `sys.id`, `sys.createdAt`

3. **Caching Strategy**:
   - Cache-aside pattern for reads
   - Full cache invalidation on writes (sync/delete)
   - 1-hour TTL for cached data

4. **Date Range Filtering**: Uses the `createdAt` field from Contentful's `sys.createdAt` timestamp.

5. **Soft Delete**: Products are never permanently deleted from the database. The `deletedAt` field is set instead.

6. **SQL Injection Prevention**: TypeORM's query builder with parameterized queries is used throughout to prevent SQL injection.

7. **Hot-Reloading**: The Docker setup mounts the local directory, enabling development without rebuilding containers.

## Dependencies

### Core Dependencies
- `@nestjs/common`, `@nestjs/core`: NestJS framework
- `@nestjs/typeorm`, `typeorm`: ORM
- `pg`: PostgreSQL driver
- `@nestjs/axios`, `rxjs`: HTTP client
- `@nestjs/cache-manager`, `cache-manager`, `cache-manager-redis-store`: Redis caching
- `@nestjs/config`: Configuration management
- `@nestjs/swagger`, `swagger-ui-express`: API documentation
- `class-validator`, `class-transformer`: DTO validation

### Dev Dependencies
- `@nestjs/testing`, `jest`, `ts-jest`: Testing
- `typescript`, `ts-node`: TypeScript support
- `eslint`, `prettier`: Code quality


### IA Usage

- Claude
- ChatGPT
- Gemini
