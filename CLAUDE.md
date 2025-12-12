# CLAUDE.md - Project Context Summary

## Project Overview
Personal website monorepo showcasing LeetCode solutions, Project Euler problems, and live Chess.com statistics tracking with historical progress visualization.

## Repository Structure
```
personal-website/
├── client/                 # Next.js Frontend (React)
│   ├── app/               # Next.js 16 App Router
│   ├── components/        # Reusable React components
│   ├── lib/              # API utilities
│   └── package.json
├── server/                # Spring Boot Backend (Java)
│   ├── src/main/java/    # Java source code
│   ├── src/main/resources/
│   └── pom.xml
├── .github/              # GitHub Actions workflows
├── README.md             # Project documentation
├── ARCHITECTURE.md       # System design details
└── docs/                 # Additional documentation
```

## Tech Stack

### Frontend (client/)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Key Dependencies**:
  - react-markdown, KaTeX (LaTeX support)
  - react-syntax-highlighter (code highlighting)
  - recharts (Chess stats visualization)
  - axios (API calls)
  - lucide-react (icons)

### Backend (server/)
- **Framework**: Spring Boot 3.2
- **Language**: Java 21
- **Database**: PostgreSQL
- **Key Features**:
  - REST API endpoints
  - Spring Data JPA
  - Scheduled tasks for Chess.com API integration
  - CORS configuration

## Key Configuration Files

### client/tsconfig.json
- Configured with path aliases: `@/*` maps to `./*`
- Next.js plugin enabled
- TypeScript strict mode disabled

### client/package.json
- Contains Next.js dev/build/start scripts
- All necessary dependencies for React, Next.js, and UI components

## Common Issues & Solutions

### Module Resolution
**Issue**: "Module not found: Can't resolve '@/components/Navigation'"
**Solution**: Ensure `tsconfig.json` has proper path mapping:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Development Commands

### Client (Frontend)
```bash
cd client
npm install           # Install dependencies
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Server (Backend)
```bash
cd server
mvn clean install   # Install dependencies
mvn spring-boot:run  # Start development server (localhost:8080)
mvn test            # Run tests
```

## API Endpoints
- `GET /api/chess/stats/current?username={username}` - Current chess stats
- `GET /api/chess/stats/history?username={username}&days=30` - Rating history
- `GET /api/chess/stats/ratings-over-time?username={username}&days=90` - Chart data
- `GET /api/chess/stats/health` - Health check

## Environment Setup

### Overview
This project uses environment variables to keep sensitive data (like database credentials) out of Git. Two files are used for local development, both are `.gitignored`:

1. **`server/src/main/resources/application-local.properties`** - Backend database credentials
2. **`client/.env.local`** - Frontend API URLs

### Quick Setup for Local Development

#### Backend Setup
```bash
cd server/src/main/resources
cp application-local.properties.example application-local.properties
# Edit application-local.properties with your Railway database credentials
```

**application-local.properties** (NOT committed to Git):
```properties
# Railway PostgreSQL Database
spring.datasource.url=jdbc:postgresql://your-railway-host:port/railway
spring.datasource.username=postgres
spring.datasource.password=YOUR_RAILWAY_PASSWORD_HERE
cors.allowed.origins=http://localhost:3000,http://localhost:3001
chess.username=shia_justdoit
```

**Run with local profile:**
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

#### Frontend Setup
```bash
cd client
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
npm run dev
```

### How Environment Variables Work

**Backend (application.properties):**
The main `application.properties` file (committed to Git) uses placeholders:
```properties
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/codingstats}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:postgres}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:postgres}
```

These will:
1. Use `application-local.properties` values when running locally with `-Dspring-boot.run.profiles=local`
2. Use Railway environment variables in production
3. Fall back to default values (after `:`) if neither is set

**Frontend (.env.local):**
Next.js automatically loads `.env.local` during development. Variables prefixed with `NEXT_PUBLIC_` are accessible in browser code.

### Security Notes
- ✅ `.gitignore` already excludes: `application-local.properties`, `.env.local`
- ✅ Never commit credentials to Git
- ✅ Use different credentials for development and production
- ⚠️ **Check before committing**: `git status` should NOT show these files

## Deployment

### Frontend (Vercel)
- **Root directory**: `client`
- **Environment Variables**: Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
- **Auto-deploy**: Pushes to `main` branch trigger deployment

### Backend (Railway)
- **Root directory**: `server`
- **Database**: PostgreSQL service (linked or separate)
- **Environment Variables**: Set via Railway dashboard:
  - `SPRING_DATASOURCE_URL`
  - `SPRING_DATASOURCE_USERNAME`
  - `SPRING_DATASOURCE_PASSWORD`
  - `CORS_ALLOWED_ORIGINS` (your Vercel URL)
  - `CHESS_USERNAME`
- **Auto-deploy**: Pushes to `main` branch trigger deployment

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.**

## Project Features
- LeetCode solutions with syntax highlighting and complexity analysis
- Project Euler problems with LaTeX mathematical formulas
- Real-time Chess.com rating tracking with visualizations
- Glass-morphism UI with gradient-based design
- Responsive design for all devices
- Automated daily chess statistics updates

## Content Structure
- LeetCode solutions: `client/content/leetcode/*.md`
- Project Euler solutions: `client/content/project-euler/*.md`
- Markdown frontmatter includes metadata (title, difficulty, tags, etc.)

## Recent Fixes
- Fixed TypeScript path alias configuration for '@' symbol
- Resolved "Module not found" error for Navigation component
- Build process now completes successfully without module resolution errors