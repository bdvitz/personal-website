# Project Architecture Document

## Project Overview
A personal website showcasing LeetCode solutions, Project Euler solutions, and live Chess.com statistics tracking with historical progress visualization.

---

## Tech Stack

### Frontend: Next.js (React)
- **Framework**: Next.js 14+ (App Router)
- **Deployment**: Vercel (free tier)
- **Styling**: Tailwind CSS
- **Key Libraries**:
  - `react-markdown` - Markdown rendering
  - `remark-math` & `rehype-katex` - LaTeX support
  - `prism-react-renderer` or `react-syntax-highlighter` - Code syntax highlighting
  - `recharts` or `chart.js` - Chess stats visualization
  - `axios` - API calls to Spring Boot backend

### Backend: Spring Boot
- **Framework**: Spring Boot 3.x (Java 17+)
- **Deployment**: Railway
- **Database**: PostgreSQL (Railway)
- **Key Dependencies**:
  - Spring Web (REST API)
  - Spring Data JPA
  - Spring Scheduler (`@Scheduled` for daily tasks)
  - PostgreSQL Driver
  - RestTemplate/WebClient (Chess.com API calls)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js Frontend (Vercel)                   │
│  ┌─────────────┬──────────────┬───────────────────┐    │
│  │  /leetcode  │ /project-euler│     /chess        │    │
│  │  Solutions  │   Solutions   │   Dashboard       │    │
│  └─────────────┴──────────────┴───────────────────┘    │
│                                                          │
│  Static Content (Markdown):                             │
│  - Problem descriptions                                 │
│  - Solutions with code blocks                           │
│  - LaTeX math formulas                                  │
└────────────────────┬────────────────────────────────────┘
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Spring Boot API (Railway)                        │
│                                                          │
│  Endpoints:                                             │
│  - GET /api/chess/stats/current                         │
│  - GET /api/chess/stats/history?days=30                 │
│  - GET /api/chess/stats/ratings-over-time               │
│                                                          │
│  Scheduled Tasks:                                       │
│  - @Scheduled(cron = "0 0 0 * * *") // Daily midnight   │
│    fetchAndStoreChessStats()                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐    ┌────────────────────┐
│  PostgreSQL DB   │    │  Chess.com API     │
│    (Railway)     │    │  (Public, Free)    │
│                  │    │                    │
│  Tables:         │    │  Endpoints:        │
│  - chess_stats   │    │  /pub/player/{id}  │
│  - daily_ratings │    │  /pub/player/{id}/ │
└──────────────────┘    │    stats           │
                        └────────────────────┘
```

---

## Frontend Architecture (Next.js)

### Directory Structure
```
nextjs-frontend/
├── app/
│   ├── layout.tsx              # Root layout with navigation
│   ├── page.tsx                # Home page
│   ├── leetcode/
│   │   ├── page.tsx            # LeetCode problems list
│   │   └── [slug]/
│   │       └── page.tsx        # Individual problem solution
│   ├── project-euler/
│   │   ├── page.tsx            # Project Euler problems list
│   │   └── [slug]/
│   │       └── page.tsx        # Individual problem solution
│   └── chess/
│       └── page.tsx            # Chess dashboard
├── components/
│   ├── CodeBlock.tsx           # Syntax-highlighted code
│   ├── MathBlock.tsx           # LaTeX rendering
│   ├── ProblemCard.tsx         # Problem preview card
│   ├── ChessStatsCard.tsx      # Individual stat display
│   └── RatingChart.tsx         # Rating progression chart
├── lib/
│   ├── api.ts                  # API client for backend
│   └── markdown.ts             # Markdown parsing utilities
├── content/
│   ├── leetcode/
│   │   ├── two-sum.md
│   │   ├── add-two-numbers.md
│   │   └── ...
│   └── project-euler/
│       ├── problem-001.md
│       ├── problem-002.md
│       └── ...
└── public/
    └── images/                 # Any diagrams or images
```

### Markdown File Format (Example)
```markdown
---
title: "Two Sum"
difficulty: "Easy"
tags: ["Array", "Hash Table"]
date: "2024-01-15"
leetcode_url: "https://leetcode.com/problems/two-sum/"
---

## Problem Description
Given an array of integers...

## Approach
We can use a hash map...

## Solution

```java
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    // ... solution code
}
```

## Complexity Analysis
- **Time Complexity**: $O(n)$
- **Space Complexity**: $O(n)$

## Explanation
The math formula: $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$
```

---

## Backend Architecture (Spring Boot)

### Directory Structure
```
spring-backend/
├── src/main/java/com/bdvitz/codingstats/
│   ├── CodingStatsApplication.java
│   ├── config/
│   │   └── WebConfig.java          # CORS configuration
│   ├── controller/
│   │   └── ChessStatsController.java
│   ├── service/
│   │   ├── ChessStatsService.java
│   │   └── ChessComApiService.java
│   ├── scheduler/
│   │   └── ChessStatsScheduler.java
│   ├── model/
│   │   ├── ChessStat.java
│   │   └── DailyRating.java
│   └── repository/
│       ├── ChessStatRepository.java
│       └── DailyRatingRepository.java
└── src/main/resources/
    └── application.properties
```

### Database Schema

#### Table: `chess_stats`
```sql
CREATE TABLE chess_stats (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    rapid_rating INT,
    blitz_rating INT,
    bullet_rating INT,
    puzzle_rating INT,
    total_games INT,
    wins INT,
    losses INT,
    draws INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_username UNIQUE (username)
);
```

#### Table: `daily_ratings`
```sql
CREATE TABLE daily_ratings (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    rapid_rating INT,
    blitz_rating INT,
    bullet_rating INT,
    puzzle_rating INT,
    CONSTRAINT unique_user_date UNIQUE (username, date)
);
```

---

## API Specifications

### Spring Boot REST Endpoints

#### 1. Get Current Chess Stats
```
GET /api/chess/stats/current?username={username}

Response:
{
  "username": "bdvitz",
  "rapidRating": 1500,
  "blitzRating": 1450,
  "bulletRating": 1400,
  "puzzleRating": 1600,
  "totalGames": 250,
  "wins": 120,
  "losses": 100,
  "draws": 30,
  "lastUpdated": "2024-01-20T00:00:00Z"
}
```

#### 2. Get Rating History
```
GET /api/chess/stats/history?username={username}&days=30

Response:
{
  "username": "bdvitz",
  "history": [
    {
      "date": "2024-01-20",
      "rapidRating": 1500,
      "blitzRating": 1450,
      "bulletRating": 1400,
      "puzzleRating": 1600
    },
    ...
  ]
}
```

#### 3. Get Ratings Over Time (Chart Data)
```
GET /api/chess/stats/ratings-over-time?username={username}&days=90

Response:
{
  "labels": ["2023-10-22", "2023-10-23", ...],
  "datasets": [
    {
      "label": "Rapid",
      "data": [1400, 1405, 1410, ...]
    },
    {
      "label": "Blitz",
      "data": [1350, 1355, 1360, ...]
    },
    ...
  ]
}
```

### Chess.com Public API (External)
```
GET https://api.chess.com/pub/player/{username}
GET https://api.chess.com/pub/player/{username}/stats
```

---

## Key Features Implementation

### 1. LaTeX Math Rendering
- Use `remark-math` and `rehype-katex` plugins with `react-markdown`
- Include KaTeX CSS in layout
- Inline: `$E = mc^2$`
- Block: `$$\int_{a}^{b} f(x)dx$$`

### 2. Code Syntax Highlighting
- Use `react-syntax-highlighter` with Prism theme
- Support multiple languages (Java, Python, JavaScript, etc.)
- Line numbers optional
- Copy-to-clipboard button

### 3. Chess Stats Daily Update
- Spring `@Scheduled` annotation with cron expression
- Runs at midnight UTC daily
- Fetches from Chess.com API
- Stores snapshot in `daily_ratings` table
- Updates latest in `chess_stats` table

### 4. Chess Dashboard Visualizations
- Current ratings cards (Rapid, Blitz, Bullet, Puzzle)
- Line chart showing rating progression over time
- Win/Loss/Draw pie chart
- Recent games performance

---

## Deployment Strategy

### Frontend (Vercel)
1. Push Next.js app to GitHub repo: `coding-stats-frontend`
2. Connect to Vercel
3. Auto-deploys on push to `main`
4. Environment variables:
   - `NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app`

### Backend (Railway)
1. Push Spring Boot app to GitHub repo: `coding-stats-backend`
2. Create Railway project
3. Add PostgreSQL plugin
4. Connect GitHub repo
5. Environment variables:
   - `SPRING_DATASOURCE_URL` (auto-populated by Railway)
   - `SPRING_DATASOURCE_USERNAME`
   - `SPRING_DATASOURCE_PASSWORD`
   - `CHESS_USERNAME=bdvitz` (your chess.com username)
   - `CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app`

---

## Development Workflow

### Phase 1: Backend Setup
1. Initialize Spring Boot project with dependencies
2. Set up PostgreSQL connection (local first)
3. Create entity models and repositories
4. Implement Chess.com API integration
5. Create REST controllers
6. Test scheduled task locally
7. Deploy to Railway

### Phase 2: Frontend Setup
1. Initialize Next.js project
2. Set up Tailwind CSS
3. Create basic layout and navigation
4. Implement markdown rendering with LaTeX and code highlighting
5. Create a few sample problem markdown files
6. Test locally

### Phase 3: Integration
1. Connect Next.js to Spring Boot API
2. Build chess dashboard with live data
3. Test end-to-end flow
4. Deploy frontend to Vercel

### Phase 4: Content Population
1. Add LeetCode solutions (markdown files)
2. Add Project Euler solutions (markdown files)
3. Refine UI/UX based on content

---

## Future Enhancements (Optional)
- Search functionality for problems
- Filter by difficulty/tags
- Dark mode toggle
- Comments section (using Giscus)
- Problem submission form
- Heatmap of solved problems
- Chess game analysis integration
- Comparison with friends' ratings

---

## Repository Structure

### Recommended GitHub Repos
1. **`coding-stats-frontend`** - Next.js application
2. **`coding-stats-backend`** - Spring Boot API

Or single monorepo:
- **`coding-stats`** with `/frontend` and `/backend` folders

---

## Notes
- Chess.com API is rate-limited (use caching)
- Railway free tier: 500 hours/month, 1GB storage
- Vercel free tier: Unlimited for personal projects
- Keep sensitive data (API keys) in environment variables
- Use `.gitignore` for local environment files

---

**Created**: 2024
**Author**: bdvitz
**Last Updated**: [Current Date]
