# Personal Website - Coding Stats & Chess Tracker

A modern, full-stack monorepo showcasing LeetCode solutions, Project Euler problems, and live Chess.com statistics tracking.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black)
![Tech Stack](https://img.shields.io/badge/Spring%20Boot-3.2-green)
![Tech Stack](https://img.shields.io/badge/PostgreSQL-16-blue)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🌟 Features

- **LeetCode Solutions** - Detailed problem solutions with syntax highlighting and complexity analysis
- **Project Euler** - Mathematical programming challenges with LaTeX formulas
- **Chess Statistics** - Real-time Chess.com rating tracking with beautiful visualizations
- **Glass-morphism UI** - Modern, gradient-based design with smooth animations
- **Responsive** - Works perfectly on desktop, tablet, and mobile

## 📁 Monorepo Structure

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
├── README.md             # This file
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Prerequisites

- **Backend**: Java 17+, Maven 3.6+, PostgreSQL
- **Frontend**: Node.js 18+, npm or yarn

### Local Development

```bash
# Clone the repository
git clone https://github.com/bdvitz/personal-website.git
cd personal-website

# Option 1: Use the start script
chmod +x start.sh
./start.sh

# Option 2: Run manually

# Terminal 1 - Backend
cd server
mvn spring-boot:run

# Terminal 2 - Frontend
cd client
npm install
npm run dev
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Health Check: http://localhost:8080/api/chess/stats/health

### Environment Variables

**Server** (create `server/src/main/resources/application-local.properties`):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/codingstats
spring.datasource.username=your_username
spring.datasource.password=your_password
chess.username=shia_justdoit
```

**Client** (create `client/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 🌐 Deployment

### Option 1: Deploy as Monorepo

Both Railway and Vercel support monorepos. Use the provided configuration files.

**Railway (Backend)**:
1. Connect GitHub repository
2. Set root directory: `server`
3. Add PostgreSQL service
4. Set environment variables

**Vercel (Frontend)**:
1. Connect GitHub repository
2. Set root directory: `client`
3. Set environment variable: `NEXT_PUBLIC_API_URL`

### Option 2: Separate Deployments

See `docs/SETUP_GUIDE.md` for detailed instructions.

## 📝 Adding Content

### LeetCode Solutions

Create markdown files in `client/content/leetcode/`:

```markdown
---
title: "Two Sum"
difficulty: "Easy"
tags: ["Array", "Hash Table"]
date: "2024-01-15"
leetcode_url: "https://leetcode.com/problems/two-sum/"
---

## Problem Description
...

## Solution
\```java
// Your solution
\```

## Complexity
- **Time**: $O(n)$
- **Space**: $O(n)$
```

### Project Euler Solutions

Create markdown files in `client/content/project-euler/`:

```markdown
---
title: "Multiples of 3 or 5"
problem_number: 1
difficulty: "Easy"
---

## Problem
...

## Solution
\```python
# Your solution
\```

## Mathematical Approach
$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$
```

## 🛠️ Tech Stack

### Frontend (`/client`)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Markdown**: react-markdown, KaTeX
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend (`/server`)
- **Framework**: Spring Boot 3.2
- **Language**: Java 17
- **Database**: PostgreSQL
- **ORM**: Spring Data JPA
- **Scheduler**: Spring @Scheduled
- **API**: RESTful

### DevOps
- **Frontend Host**: Vercel
- **Backend Host**: Railway
- **Database**: Railway PostgreSQL
- **CI/CD**: GitHub Actions

## 📊 API Endpoints

### Chess Statistics

- `GET /api/chess/stats/current?username={username}` - Get current stats
- `POST /api/chess/stats/refresh?username={username}` - Refresh from Chess.com
- `GET /api/chess/stats/history?username={username}&days=30` - Get history
- `GET /api/chess/stats/ratings-over-time?username={username}&days=90` - Chart data
- `GET /api/chess/stats/health` - Health check

## 🔄 Automated Tasks

The backend automatically fetches chess statistics daily at midnight UTC using Spring's `@Scheduled` annotation.

## 📚 Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Deployment instructions
- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Documentation](docs/API.md) - Endpoint details
- [Contributing](docs/CONTRIBUTING.md) - How to contribute

## 🎨 Screenshots

*Coming soon - add screenshots of your deployed application*

## 🤝 Why Monorepo?

**Benefits of this monorepo structure:**

✅ **Single source of truth** - All code in one place  
✅ **Easier development** - Run both client and server together  
✅ **Shared tooling** - One set of CI/CD pipelines  
✅ **Atomic commits** - Update frontend and backend together  
✅ **Better for personal projects** - Simpler management  
✅ **GitHub portfolio** - One impressive repo vs. two split repos  

## 📈 Project Stats

- **Languages**: Java, TypeScript, CSS
- **Total Files**: 35+
- **Lines of Code**: 2,500+
- **Components**: 5+
- **API Endpoints**: 6

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Java version
java -version  # Should be 17+

# Check if PostgreSQL is running
psql --version

# View logs
cd server
mvn spring-boot:run
```

### Frontend errors
```bash
# Reinstall dependencies
cd client
rm -rf node_modules package-lock.json
npm install

# Check API connection
curl http://localhost:8080/api/chess/stats/health
```

## 📝 License

MIT License - feel free to use this for your own projects!

## 👤 Author

**bdvitz**
- GitHub: [@bdvitz](https://github.com/bdvitz)
- Chess.com: [shia_justdoit](https://chess.com/member/shia_justdoit)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Spring Boot community
- Chess.com for the public API
- Vercel and Railway for free hosting

---

**Built with ❤️ using Next.js and Spring Boot**
