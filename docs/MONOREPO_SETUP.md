# 🚀 Monorepo Setup Guide

## Why Monorepo?

Using a **single repository** with `client/` and `server/` folders is better for personal projects because:

✅ **Simpler Management** - One repo to clone, one place for issues/PRs  
✅ **Atomic Commits** - Update frontend and backend together  
✅ **Easier Development** - Run both with one command  
✅ **Better Portfolio** - One impressive GitHub repo instead of two split repos  
✅ **Shared CI/CD** - One set of workflows  
✅ **Version Control** - Keep client/server versions in sync  

## 📁 Repository Structure

```
personal-website/
├── client/                    # Next.js Frontend
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── package.json
│   └── .env.local (create this)
├── server/                    # Spring Boot Backend
│   ├── src/
│   ├── pom.xml
│   └── application.properties
├── .github/
│   └── workflows/
├── docs/
├── README.md
├── .gitignore
├── start.sh
├── railway.json              # Railway config
└── vercel.json              # Vercel config
```

---

## 🎯 Quick Start

### Step 1: Create GitHub Repository

1. Go to https://github.com/bdvitz
2. Click "New repository"
3. Name it: **`personal-website`**
4. Make it **public** (for portfolio visibility)
5. **Don't** initialize with README (we have one)
6. Click "Create repository"

### Step 2: Push Your Code

```bash
# Navigate to your downloaded project
cd personal-website

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Personal website with chess stats"

# Add remote
git remote add origin https://github.com/bdvitz/personal-website.git

# Push
git branch -M main
git push -u origin main
```

---

## 🌐 Deployment

### Option 1: Monorepo Deploy (Recommended)

Both Railway and Vercel support monorepos. The configuration files are already set up!

#### Deploy Backend to Railway

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `bdvitz/personal-website`
5. Railway will detect `railway.json` and automatically:
   - Build from `server/` directory
   - Run Maven build
   - Start Spring Boot

6. **Add PostgreSQL:**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway auto-connects it to your app

7. **Set Environment Variables:**
   ```
   CHESS_USERNAME=shia_justdoit
   CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```
   (Database variables are auto-set by Railway)

8. **Get your Railway URL:**
   - Example: `https://personal-website-production.up.railway.app`

#### Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New" → "Project"
4. Import `bdvitz/personal-website`
5. **Vercel will detect `vercel.json` and automatically:**
   - Build from `client/` directory
   - Install dependencies
   - Build Next.js app

6. **Configure:**
   - Root Directory: Leave blank (will use vercel.json)
   - Framework Preset: Next.js (auto-detected)
   - Build Command: (uses vercel.json)
   - Output Directory: (uses vercel.json)

7. **Set Environment Variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app
   ```

8. Click "Deploy"

9. **Update Railway CORS:**
   - Go back to Railway
   - Update `CORS_ALLOWED_ORIGINS` with your Vercel URL
   - Redeploy backend

### Option 2: Manual Configuration

If automatic detection doesn't work:

**Railway:**
- Build Command: `cd server && mvn clean package -DskipTests`
- Start Command: `cd server && java -jar target/*.jar`

**Vercel:**
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

---

## 🔧 Local Development

### Quick Start

```bash
# Make script executable
chmod +x start.sh

# Run everything
./start.sh
# Choose option 1 for first-time setup
```

### Manual Start

**Terminal 1 - Backend:**
```bash
cd server
mvn spring-boot:run
```

**Terminal 2 - Frontend:**
```bash
cd client
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- Health: http://localhost:8080/api/chess/stats/health

### Environment Setup

**Backend** (`server/src/main/resources/application-local.properties`):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/codingstats
spring.datasource.username=postgres
spring.datasource.password=your_password
chess.username=shia_justdoit
cors.allowed.origins=http://localhost:3000
```

**Frontend** (`client/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## 📝 Git Workflow

### Daily Development

```bash
# Create feature branch
git checkout -b feature/new-leetcode-solution

# Make changes
# ... edit files ...

# Commit
git add .
git commit -m "Add: Two Sum LeetCode solution"

# Push
git push origin feature/new-leetcode-solution

# Create PR on GitHub (optional for personal project)
# Or merge directly:
git checkout main
git merge feature/new-leetcode-solution
git push origin main
```

### Adding Content

```bash
# Add new LeetCode solution
cd client/content/leetcode
nano two-sum.md
# ... write solution ...

# Commit from root
cd ../../../
git add client/content/leetcode/two-sum.md
git commit -m "Add: Two Sum solution"
git push

# Vercel auto-deploys! ✨
```

---

## 🎨 Customization

### Update Chess Username

**Backend:**
```bash
# Edit server/src/main/resources/application.properties
chess.username=your_chess_username

# Or set as environment variable in Railway
CHESS_USERNAME=your_chess_username
```

**Frontend:**
```bash
# Edit client/app/chess/page.tsx
# Replace 'shia_justdoit' with your username
```

### Update Branding

**Frontend navigation:**
```bash
# Edit client/components/Navigation.tsx
<span className="text-xl font-bold">Your Name</span>
```

**Page titles:**
```bash
# Edit client/app/layout.tsx
title: 'Your Name | Coding Stats',
```

### Change Colors

```bash
# Edit client/tailwind.config.js
# Edit client/app/globals.css
```

---

## 🔍 Testing Your Deployment

### Backend Health Check

```bash
# Test Railway deployment
curl https://your-railway-app.railway.app/api/chess/stats/health

# Should return:
# {"status":"UP","service":"Chess Stats API"}
```

### Fetch Chess Stats

```bash
# Test data fetching
curl "https://your-railway-app.railway.app/api/chess/stats/current?username=shia_justdoit"
```

### Frontend Check

1. Visit your Vercel URL
2. Navigate to Chess Stats page
3. Verify data loads
4. Check charts display correctly

---

## 📊 Monitoring

### Railway Dashboard
- View server logs
- Monitor database usage
- Check API metrics
- See build history

### Vercel Dashboard
- View build logs
- Monitor traffic
- Check performance
- See deployment history

### GitHub
- Every push triggers auto-deployment
- View commit history
- Track issues/PRs

---

## 🐛 Troubleshooting

### Railway build fails
```bash
# Check logs in Railway dashboard
# Common issues:
- Java version (must be 17+)
- Maven build errors
- Database connection
```

### Vercel build fails
```bash
# Check build logs in Vercel
# Common issues:
- Node version (must be 18+)
- Missing dependencies
- Environment variables
```

### CORS errors
```bash
# Update Railway environment variable:
CORS_ALLOWED_ORIGINS=https://your-exact-vercel-url.vercel.app

# Redeploy backend
```

### Chess stats not loading
```bash
# Check Railway logs
# Manually trigger refresh:
curl -X POST "https://your-railway-app.railway.app/api/chess/stats/refresh?username=shia_justdoit"
```

---

## 📈 Adding Features

### Add New Page

```bash
cd client/app
mkdir new-page
nano new-page/page.tsx
# ... create page ...
```

### Add API Endpoint

```bash
cd server/src/main/java/com/bdvitz/codingstats
# Add controller, service, etc.
```

### Update Database Schema

```bash
# Edit entity models in server/src/main/java/.../model/
# Spring Boot auto-updates schema (ddl-auto=update)
```

---

## 🎯 Best Practices

### Commits
- ✅ Commit often with clear messages
- ✅ Use prefixes: "Add:", "Fix:", "Update:"
- ✅ Test locally before pushing

### Branches
- Use branches for big features
- Merge to main when ready
- Keep main deployable

### Environment Variables
- Never commit secrets
- Use .env.local for local dev
- Set in Railway/Vercel for production

### Documentation
- Update README as you add features
- Comment your code
- Document API changes

---

## 🚀 Next Steps

1. ✅ Repository created and pushed
2. ✅ Backend deployed to Railway
3. ✅ Frontend deployed to Vercel
4. ✅ Environment variables configured
5. ⏳ Add your first LeetCode solution
6. ⏳ Add your first Project Euler solution
7. ⏳ Customize branding
8. ⏳ Share on LinkedIn!

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Spring Boot Docs](https://spring.io/projects/spring-boot)
- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [Chess.com API](https://www.chess.com/news/view/published-data-api)

---

## ✨ Success!

Your monorepo is set up and deployed! 

**Live URLs:**
- Frontend: https://your-app.vercel.app
- Backend: https://your-app.railway.app
- GitHub: https://github.com/bdvitz/personal-website

**All changes you push to GitHub will automatically deploy!** 🎉

---

*Questions? Check the main README or create an issue on GitHub*
