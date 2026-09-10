Phase 2.75: The Pre-Repo Deep Clean
Project: Highland Events Hub Objective: Sanitize the codebase, remove legacy "Gamification" features, consolidate environments, and organize the file structure for Git initialization.

🧹 Sprint 1: Environment & File Hygiene
Goal: Clean the root directory and fix the duplicate virtual environments.

1. The Duplicate Venv Fix
Problem: Two virtual environments exist (likely venv and .venv or env).

Action:

Identify the currently active one (check VS Code settings or terminal).

Delete the unused folder.

Update .gitignore: Ensure strict ignores for python environments:

Plaintext

venv/
.venv/
env/
__pycache__/
*.pyc
.DS_Store
.env
.env.local
2. The "Script Graveyard"
Problem: Root folder is cluttered with temporary tests (e.g., test_db.py, fix_users.py, seed_temp.py).

Action:

Create directory: scripts/_archive/.

Move all root-level Python scripts (except main.py, app.py, or manage.py) into this folder.

Add scripts/_archive/ to .gitignore.

🗄️ Sprint 2: Database & Backend Sanitation
Goal: Permanently remove the "Gamification" system.

1. Database Migration
Action: Generate a new Alembic migration.

Operations:

op.drop_column('users', 'xp')

op.drop_column('users', 'score')

op.drop_column('users', 'level')

op.drop_table('leaderboards') (if exists).

2. Backend Code Cleanup
Models (models.py): Remove xp, score, level fields from the User class.

Schemas (schemas/user.py): Remove these fields from Pydantic models (UserBase, UserOut).

Logic Check: Search crud/ and routers/ for any logic that calculates score additions and remove it.

🎨 Sprint 3: Frontend "Dead Code" Removal
Goal: Stop the UI from trying to fetch missing data.

1. UI Components
Search: user.xp, user.level, Leaderboard.

Action: Remove the visual elements (badges, progress bars). If a component file is now empty/unused, delete the file.

2. Type Definitions
File: types/user.ts or types/auth.ts.

Action: Remove xp and level from the TypeScript interfaces to prevent build errors.