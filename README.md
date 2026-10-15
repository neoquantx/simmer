# Simmer

Snap your fridge or type what you have. Get exactly three doable recipes, with steps and a short “need to buy” list.

No accounts, no calorie grading, works offline. Kitchen data stays on your machine.

Built for the Hacktoberfest Side Hustle track.

## What it does

- Photo of the fridge, or typed ingredients, becomes three recipes ranked by how little you still need to buy.
- Constraints: 15 minutes, spicy, one-pot, vegetarian.
- Recipe box for saved meals, including recipes pulled out of a social screenshot.
- Anonymous session id in `localStorage`. No sign-up.
- Installable PWA (`manifest.json` + service worker).

## Stack

| Layer | Choice |
|---|---|
| Model | Gemma 3 4B through Ollama (text and vision, one model) |
| API | FastAPI |
| Data | SQLite by default, MongoDB Atlas if `DB_BACKEND=mongo`, in-memory if both fail |
| UI | React, Vite, Tailwind |

## Layout

```text
backend/          FastAPI app (run from this directory)
  main.py         routes
  ai_client.py    Ollama client
  prompts.py      model prompts
  storage.py      sqlite / mongo / memory
  .env.example    config template
frontend/         Vite + React PWA
  src/components  screens
  src/utils       API client and session id
  public/         manifest, service worker, icons
```

## Run locally

Prerequisites: Python 3.10+, Node 18+, Ollama.

```bash
ollama pull gemma3:4b
ollama serve
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

API: http://localhost:8000 — docs at http://localhost:8000/docs

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Hosted mode

Set these in `backend/.env`:

```bash
DB_BACKEND=mongo
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/simmer
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

If MongoDB is unreachable, storage falls back to SQLite, then to memory, and the process stays up.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/ingredients-from-photo` | Ingredients from a fridge photo |
| `POST` | `/api/suggest` | Three recipes for the current pantry and constraint |
| `POST` | `/api/save-from-screenshot` | Extract a recipe from a screenshot and save it |
| `GET` / `POST` | `/api/pantry` | Read or save ingredients and dislikes |
| `GET` | `/api/recipe-box` | Saved recipes |
| `DELETE` | `/api/recipe-box/{id}` | Remove a saved recipe |
| `GET` | `/api/health` | Process, database, and Ollama status |

## Privacy

Inference runs on your Ollama process, not a third-party model API. There are no accounts. The session id never leaves the browser except as a key on your own API.
