# Contributing Guide

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/amanai-kz/aman-ai.git
cd aman-ai

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env

# 4. Run development server
npm run dev
```

## 🌿 Branch Naming

```
feature/issue-number-short-description
bugfix/issue-number-short-description
hotfix/critical-fix-description
```

**Examples:**
- `feature/1-simplify-reports`
- `bugfix/15-fix-pdf-export`
- `hotfix/auth-crash`

## 📝 Commit Messages

Use conventional commits format:

```
type(scope): description

[optional body]
[optional footer]
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

**Examples:**
```bash
feat(reports): add PDF export functionality
fix(auth): resolve login redirect issue
docs(readme): update installation steps
refactor(api): simplify consultation endpoint
```

## 🔄 Workflow

### 1. Start Working on an Issue

```bash
# Get latest changes
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/1-simplify-reports
```

### 2. Make Changes & Commit

```bash
# Stage changes
git add .

# Commit with message
git commit -m "feat(reports): remove sleep/mood/stress fields"

# Push to remote
git push origin feature/1-simplify-reports
```

### 3. Create Pull Request

1. Go to GitHub → Pull Requests → New
2. Select your branch → `main`
3. Fill in description:
   - What changes were made
   - Link to issue: `Closes #1`
   - Screenshots (if UI changes)
4. Request review from team member

### 4. After Review

```bash
# If changes requested, make them and push
git add .
git commit -m "fix(reports): address review comments"
git push origin feature/1-simplify-reports
```

### 5. Merge & Cleanup

After approval:
1. Squash and merge on GitHub
2. Delete the branch on GitHub
3. Locally:
```bash
git checkout main
git pull origin main
git branch -d feature/1-simplify-reports
```

## ⚠️ Rules

1. **Never push directly to `main`** - always use PRs
2. **One feature = one branch** - don't mix unrelated changes
3. **Keep PRs small** - easier to review
4. **Write clear commit messages** - future you will thank you
5. **Test before pushing** - run `npm run build` locally

## 🛠️ Useful Commands

```bash
# Check current branch
git branch

# See all branches
git branch -a

# Switch branch
git checkout branch-name

# See changes
git status
git diff

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Stash changes temporarily
git stash
git stash pop
```

## 📋 PR Checklist

Before submitting PR:
- [ ] Code builds without errors (`npm run build`)
- [ ] No console errors in browser
- [ ] Tested on localhost
- [ ] Commit messages follow convention
- [ ] PR description is clear
- [ ] Issue is linked



