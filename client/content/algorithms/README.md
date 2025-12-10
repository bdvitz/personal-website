# Algorithms Content Directory

This directory contains markdown files for algorithm solutions displayed on the `/algorithms` page.

## File Naming Convention

- Use lowercase with hyphens: `two-sum.md`, `euler-001.md`
- The filename (without .md) becomes the URL slug: `/algorithms/two-sum`

## Frontmatter Format

Each markdown file must include frontmatter with the following fields:

```yaml
---
title: "Article Title"
category: "leetcode" | "project-euler" | "puzzles" | "math"
difficulty: "Easy" | "Medium" | "Hard"
tags: ["Tag1", "Tag2", "Tag3"]
date: "YYYY-MM-DD"
excerpt: "Brief summary for card display (1-2 sentences)"
source_url: "https://..." (optional - link to original problem)
---
```

## Markdown Content

After the frontmatter, write your content using standard Markdown:

- Use `##` for main sections (H2)
- Use `###` for subsections (H3)
- Code blocks with syntax highlighting: ` ```javascript `
- LaTeX math is supported (KaTeX is already loaded in the app)
- Inline code: `code here`
- Links, lists, bold, italic all work as expected

## Images

Images can be added using standard markdown syntax with optional sizing via the title attribute:

### Basic Image (Default Size)
```markdown
![Alt text](/algorithms/image.png)
```
Default max width: 448px (centered)

### Custom Width
```markdown
![Alt text](/algorithms/image.png "w:350")
```
Sets max width to 350px

### Full Width
```markdown
![Alt text](/algorithms/image.png "w:full")
```
Image takes full container width

### Custom Height
```markdown
![Alt text](/algorithms/image.png "h:400")
```
Sets height to 400px

### Both Dimensions
```markdown
![Alt text](/algorithms/image.png "w:500,h:300")
```
Sets both max width and height

### Image Placement
- All images are automatically centered
- Images include rounded corners and shadow styling
- Vertical spacing (margin) is added automatically

## Categories

- **leetcode**: LeetCode problems
- **project-euler**: Project Euler mathematical challenges
- **puzzles**: General algorithmic puzzles
- **math**: Mathematical problems and solutions

## Example Files

See `two-sum.md` for a complete example of a LeetCode solution.

## Loading Content (TODO)

The current implementation uses hardcoded sample data in:
- `app/algorithms/page.tsx` - Main listing page
- `app/algorithms/[slug]/page.tsx` - Individual article page

To load actual markdown files, you'll need to:
1. Install `gray-matter` for parsing frontmatter: `npm install gray-matter`
2. Use Node.js `fs` module to read files at build time
3. Update the pages to use `generateStaticParams()` for static generation
4. Parse markdown content with the existing `react-markdown` setup

Example implementation can follow Next.js documentation on file-based content.
