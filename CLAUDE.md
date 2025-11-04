# CLAUDE.md - Project Context Summary

## Project Overview
Personal website monorepo showcasing LeetCode solutions, Project Euler problems, and live Chess.com statistics tracking with historical progress visualization.

## Repository Structure
```
personal-website/
├── client/                 # Next.js Frontend (React)
│   ├── app/               # Next.js 14 App Router
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
- **Framework**: Next.js 14 (App Router)
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
- **Language**: Java 17
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

### Client (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Server (application-local.properties)
```
spring.datasource.url=jdbc:postgresql://localhost:5432/codingstats
spring.datasource.username=your_username
spring.datasource.password=your_password
chess.username=shia_justdoit
```

## Deployment
- **Frontend**: Vercel (root directory: client)
- **Backend**: Railway (root directory: server, PostgreSQL service)

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