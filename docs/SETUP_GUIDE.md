# 🚀 Complete Setup Guide

## Step 1: Create GitHub Repositories

1. Go to https://github.com/bdvitz
2. Create two new repositories:
   - `coding-stats-backend` (Spring Boot API)
   - `coding-stats-frontend` (Next.js App)
3. Initialize both as public repositories

## Step 2: Set Up Backend Repository

### Clone and Add Files

```bash
# Clone your new backend repo
git clone https://github.com/bdvitz/coding-stats-backend.git
cd coding-stats-backend

# Copy all files from the generated backend folder
# (Download from Claude and copy to this directory)

# Add ARCHITECTURE.md to root
cp ARCHITECTURE.md ./

# Initialize git
git add .
git commit -m "Initial commit: Spring Boot Chess Stats API"
git push origin main
```

### Local Development

```bash
# Install PostgreSQL locally (or use Docker)
docker run --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=codingstats -p 5432:5432 -d postgres

# Run the application
mvn clean install
mvn spring-boot:run

# Test the API
curl http://localhost:8080/api/chess/stats/health
```

### Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `coding-stats-backend`
4. Add PostgreSQL service: "New" → "Database" → "PostgreSQL"
5. Set environment variables in Railway dashboard:
   ```
   CHESS_USERNAME=bdvitz
   CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
   (Railway auto-populates database credentials)
6. Deploy! Railway will:
   - Detect Maven project
   - Run `mvn clean package`
   - Start the application
7. Copy your Railway app URL (e.g., `https://your-app.railway.app`)

## Step 3: Set Up Frontend Repository

### Clone and Add Files

```bash
# Clone your new frontend repo
git clone https://github.com/bdvitz/coding-stats-frontend.git
cd coding-stats-frontend

# Copy all files from the generated frontend folder
# (Download from Claude and copy to this directory)

# Add ARCHITECTURE.md to root
cp ARCHITECTURE.md ./

# Initialize git
git add .
git commit -m "Initial commit: Next.js Coding Stats Frontend"
git push origin main
```

### Local Development

```bash
# Install dependencies
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local

# Run development server
npm run dev

# Open http://localhost:3000
```

### Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New" → "Project"
3. Import `coding-stats-frontend` repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
5. Add Environment Variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app
   ```
6. Click "Deploy"
7. Wait for deployment to complete
8. Visit your new site!

## Step 4: Update CORS Settings

After frontend is deployed, update Railway environment variables:

1. Go to Railway project
2. Select your backend service
3. Update environment variable:
   ```
   CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```
4. Redeploy the backend

## Step 5: Add Content

### Create Your First LeetCode Solution

```bash
cd coding-stats-frontend
mkdir -p content/leetcode
nano content/leetcode/two-sum.md
```

Add content (see README for format), then:

```bash
git add content/
git commit -m "Add Two Sum solution"
git push
```

Vercel will automatically redeploy!

### Create Your First Project Euler Solution

```bash
mkdir -p content/project-euler
nano content/project-euler/problem-001.md
```

Add content, commit, and push.

## Step 6: Test the Application

### Test Backend API

```bash
# Health check
curl https://your-railway-app.railway.app/api/chess/stats/health

# Fetch chess stats (first time will take a moment)
curl https://your-railway-app.railway.app/api/chess/stats/current?username=bdvitz

# Get historical data
curl https://your-railway-app.railway.app/api/chess/stats/ratings-over-time?username=bdvitz&days=30
```

### Test Frontend

1. Visit https://your-vercel-app.vercel.app
2. Navigate to Chess Stats page
3. Click "Refresh Data" to fetch latest stats
4. Verify charts display correctly
5. Test navigation between pages

## Step 7: Monitor and Maintain

### Railway Dashboard
- Monitor backend logs
- Check database usage
- View API response times

### Vercel Dashboard
- Check deployment status
- View analytics
- Monitor performance

### GitHub
- Both repos will auto-deploy on push
- Create branches for new features
- Use pull requests for review

## 🎯 Quick Reference

### Backend (Railway)
- **URL**: https://your-railway-app.railway.app
- **API Docs**: `/api/chess/stats/health`
- **Database**: PostgreSQL (Railway managed)
- **Auto-updates**: Daily at midnight UTC

### Frontend (Vercel)
- **URL**: https://your-vercel-app.vercel.app
- **Pages**: /, /leetcode, /project-euler, /chess
- **Content**: Markdown files in `content/` directory
- **Auto-deploys**: On push to main branch

## 🔧 Common Issues

### Backend won't start
- Check Railway logs
- Verify database connection
- Ensure PORT environment variable is set (Railway auto-sets this)

### Frontend API errors
- Verify NEXT_PUBLIC_API_URL is correct
- Check CORS settings in backend
- Test backend API directly with curl

### No chess data showing
- Wait for first scheduled update (midnight UTC)
- Or manually trigger: POST to `/api/chess/stats/refresh?username=bdvitz`
- Check Railway logs for scheduler errors

### Markdown not rendering
- Verify frontmatter format
- Check file encoding (UTF-8)
- Look for syntax errors in markdown

## 📚 Next Steps

1. **Add more solutions** - Create markdown files for your solved problems
2. **Customize styling** - Edit Tailwind classes in components
3. **Add features** - Search, filters, tags, etc.
4. **Share it** - Add to your resume, LinkedIn, portfolio

## 🎨 Customization Tips

### Change color scheme
Edit `tailwind.config.js`:
```js
colors: {
  primary: {
    // Your custom colors
  }
}
```

### Update gradient background
Edit `app/globals.css`:
```css
:root {
  --gradient-primary: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

### Add your own chess username
Update Railway environment variable:
```
CHESS_USERNAME=your_chess_username
```

---

## ✅ Checklist

- [ ] Created GitHub repositories
- [ ] Deployed backend to Railway
- [ ] Deployed frontend to Vercel
- [ ] Updated CORS settings
- [ ] Tested API endpoints
- [ ] Added first LeetCode solution
- [ ] Added first Project Euler solution
- [ ] Verified chess stats loading
- [ ] Customized with your information
- [ ] Shared your new site!

---

**Need help?** Check the README.md files in each directory or create an issue on GitHub.

**Congratulations! 🎉 Your coding stats website is live!**
