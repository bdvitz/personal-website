# How to Add New Algorithm Articles

This guide explains how to add new articles to the Algorithms blog page.

## Current System Overview

The current implementation uses **hardcoded data** in TypeScript files rather than loading markdown files directly. This is a quick method that works without additional build configuration.

### Why Hardcoded?

- No need for additional file system utilities during build
- Faster initial development
- Works out-of-the-box without gray-matter parsing setup
- Easy to understand for small numbers of articles

### Files Involved

1. `client/app/algorithms/page.tsx` - Main listing page
2. `client/app/algorithms/[slug]/page.tsx` - Individual article pages
3. `client/content/algorithms/*.md` - Markdown reference files (optional, for your records)

## Step-by-Step: Adding a New Article

### Step 1: Create the Markdown File (Optional but Recommended)

Create a new file in `client/content/algorithms/your-article-name.md`:

```markdown
---
title: "Your Article Title"
category: "leetcode" | "project-euler" | "puzzles" | "math"
difficulty: "Easy" | "Medium" | "Hard"
tags: ["Tag1", "Tag2", "Tag3"]
date: "YYYY-MM-DD"
excerpt: "Brief summary for the card (1-2 sentences)"
source_url: "https://..." (optional)
---

## Your Content Here

Write your article content using markdown...

\`\`\`python
# Code blocks work
def example():
    pass
\`\`\`

Math works too: $E = mc^2$

Display math:
$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
```

### Step 2: Add to Main Listing Page

Edit `client/app/algorithms/page.tsx`:

1. Find the `samplePosts` array (around line 25)
2. Add a new object with the summary data:

```typescript
{
  slug: 'your-article-name',  // Must match URL slug
  title: 'Your Article Title',
  difficulty: 'Medium',
  tags: ['Tag1', 'Tag2'],
  date: '2024-12-05',
  excerpt: 'Brief summary...',
  category: 'leetcode'  // or project-euler, puzzles, math
}
```

### Step 3: Add Full Content to Individual Page

Edit `client/app/algorithms/[slug]/page.tsx`:

1. Find the `allPosts` array (around line 35)
2. Add a new object with ALL the content:

```typescript
{
  slug: 'your-article-name',  // Must match the slug from Step 2
  title: 'Your Article Title',
  difficulty: 'Medium',
  tags: ['Tag1', 'Tag2'],
  date: '2024-12-05',
  category: 'leetcode',
  sourceUrl: 'https://leetcode.com/...',  // Optional
  content: `## Your Content Here

Write your full article content here...

\`\`\`python
def example():
    pass
\`\`\`

Math: $E = mc^2$

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
`  // Note: Use backticks to escape properly
}
```

### Step 4: Escape Special Characters

When copying content into the `content` field:

- **Backticks in code blocks**: Use `\`\`\`` to escape them
- **Dollar signs in LaTeX**: Escape as `\\$` if needed
- **Backslashes in LaTeX**: Use `\\` instead of single `\`
- **Example**: `$\\sum_{i=1}^{n}$` in markdown becomes `$\\\\sum_{i=1}^{n}$` in the template string

### Step 5: Test Your Article

1. Save both files
2. Navigate to `http://localhost:3000/algorithms`
3. Verify your article appears in the listing
4. Click on it to view the full content
5. Check that code highlighting and math rendering work

## Formatting Tips

### Code Blocks with Syntax Highlighting

```markdown
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\`
```

Supported languages: python, javascript, java, cpp, c, rust, go, typescript, etc.

### LaTeX Math

**Inline math**: `$E = mc^2$`

**Display math**:
```
$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
```

### Markdown Features

- **Bold**: `**text**`
- *Italic*: `*text*`
- Lists: `- item` or `1. item`
- Links: `[text](url)`
- Headings: `##`, `###` (don't use `#` - it's for the main title)

## Categories Explained

- **`leetcode`**: LeetCode coding problems
- **`project-euler`**: Project Euler mathematical challenges
- **`puzzles`**: General algorithmic puzzles and interesting problems
- **`math`**: Mathematical proofs, theorems, or math-heavy content

These categories power the filter buttons on the main page.

## Future: Automatic Markdown Loading

To switch from hardcoded data to automatic markdown file loading:

1. Install `gray-matter` (already in package.json)
2. Use Next.js `fs` module to read files at build time
3. Implement `generateStaticParams()` for static generation
4. Parse frontmatter and content separately
5. Update both page components to use the file system

This would let you add articles by just creating markdown files, but requires more setup.

## Troubleshooting

### Article doesn't appear on listing page
- Check that you added it to the `samplePosts` array in `page.tsx`
- Verify the `slug` matches exactly (case-sensitive)

### 404 error when clicking article
- Ensure you added it to `allPosts` array in `[slug]/page.tsx`
- Check that both `slug` values match exactly

### Code blocks not highlighting
- Verify you used triple backticks: \`\`\`language
- Check that the language identifier is valid
- Make sure the ReactMarkdown component has the syntax highlighter configured

### Math not rendering
- Ensure dollar signs are properly escaped: `$` or `$$`
- Check backslashes are doubled: `\\` instead of `\`
- Verify KaTeX CSS is loaded (should be in `layout.tsx`)

### Jest worker error
- This usually means there's a syntax error in the TypeScript
- Check for unescaped backticks or quotes in your content string
- Make sure all template strings are properly closed

## Example: Complete Article Addition

See `client/content/algorithms/snake-puzzle.md` for a complete example showing:
- Python code blocks
- LaTeX math formulas
- Proper frontmatter
- Section organization

You can copy this as a template for your own articles!
