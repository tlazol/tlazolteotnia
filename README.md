# Tlazol

Personal site for Daisuke Kobayashi / Tlazolteotnia, built with React Router.

## Content

Blog posts live in `content/blog` as Markdown files with frontmatter:

```md
---
title: "Post title"
date: "2026-05-15"
description: "Short description"
tags: ["React", "Diary"]
draft: false
---
```

Draft posts are hidden from the home page and direct blog routes.

## Development

Install the dependencies:

```bash
npm install
```

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Checks

Run type checking and a production build:

```bash
npm run typecheck
npm run build
```
