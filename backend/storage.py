"""Storage layer for Simmer.

Provides an abstract interface and implementations for:
1. SQLite (local simmer.db)
2. MongoDB Atlas (via pymongo)
3. InMemoryBackend (fallback)

All methods are asynchronous and follow the same signature.
"""

from abc import ABC, abstractmethod
import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    """Abstract base class for Simmer storage backends."""

    @property
    @abstractmethod
    def backend_name(self) -> str:
        """Name of the storage backend ('sqlite', 'mongo', or 'memory')."""
        pass

    @abstractmethod
    async def get_pantry(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the pantry for a given session."""
        pass

    @abstractmethod
    async def save_pantry(
        self, session_id: str, ingredients: List[str], dislikes: List[str]
    ) -> Dict[str, Any]:
        """Save or update pantry ingredients and dislikes for a session."""
        pass

    @abstractmethod
    async def get_recipe_box(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve all saved recipes for a session."""
        pass

    @abstractmethod
    async def save_recipe(
        self, session_id: str, recipe_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save a recipe into the recipe box, assigning an id and created_at timestamp."""
        pass

    @abstractmethod
    async def delete_recipe(self, session_id: str, recipe_id: str) -> bool:
        """Delete a recipe from the recipe box for a session."""
        pass

    @abstractmethod
    async def save_history(
        self, session_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save an entry to cooking/suggestion history."""
        pass

    @abstractmethod
    async def get_history(
        self, session_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get history entries for a session, ordered from newest to oldest."""
        pass


class SqliteBackend(StorageBackend):
    """SQLite implementation of StorageBackend storing data in simmer.db."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path:
            self.db_path = Path(db_path)
        else:
            self.db_path = Path(__file__).resolve().parent / "simmer.db"
        self._lock = asyncio.Lock()
        self._init_db()

    @property
    def backend_name(self) -> str:
        return "sqlite"

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize database schema synchronously."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS pantries (
                    session_id TEXT UNIQUE PRIMARY KEY,
                    ingredients TEXT,
                    dislikes TEXT,
                    updated_at TEXT
                );
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS recipe_box (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    title TEXT,
                    ingredients TEXT,
                    steps TEXT,
                    source TEXT,
                    image_ref TEXT,
                    created_at TEXT
                );
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    ingredients_used TEXT,
                    constraint_text TEXT,
                    recipes TEXT,
                    cooked TEXT,
                    created_at TEXT
                );
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_recipe_box_session
                ON recipe_box(session_id, created_at DESC);
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_history_session
                ON history(session_id, created_at DESC);
                """
            )
            conn.commit()

    async def get_pantry(self, session_id: str) -> Optional[Dict[str, Any]]:
        def _query():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT session_id, ingredients, dislikes, updated_at FROM pantries WHERE session_id = ?",
                    (session_id,),
                )
                row = cursor.fetchone()
                if not row:
                    return None
                return {
                    "session_id": row["session_id"],
                    "ingredients": json.loads(row["ingredients"] or "[]"),
                    "dislikes": json.loads(row["dislikes"] or "[]"),
                    "updated_at": row["updated_at"],
                }

        async with self._lock:
            return await asyncio.to_thread(_query)

    async def save_pantry(
        self, session_id: str, ingredients: List[str], dislikes: List[str]
    ) -> Dict[str, Any]:
        updated_at = datetime.now(timezone.utc).isoformat()
        ingredients_json = json.dumps(ingredients)
        dislikes_json = json.dumps(dislikes)

        def _execute():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO pantries (session_id, ingredients, dislikes, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(session_id) DO UPDATE SET
                        ingredients = excluded.ingredients,
                        dislikes = excluded.dislikes,
                        updated_at = excluded.updated_at;
                    """,
                    (session_id, ingredients_json, dislikes_json, updated_at),
                )
                conn.commit()

        async with self._lock:
            await asyncio.to_thread(_execute)

        return {
            "session_id": session_id,
            "ingredients": list(ingredients),
            "dislikes": list(dislikes),
            "updated_at": updated_at,
        }

    async def get_recipe_box(self, session_id: str) -> List[Dict[str, Any]]:
        def _query():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, session_id, title, ingredients, steps, source, image_ref, created_at
                    FROM recipe_box
                    WHERE session_id = ?
                    ORDER BY created_at DESC
                    """,
                    (session_id,),
                )
                rows = cursor.fetchall()
                recipes = []
                for row in rows:
                    recipes.append(
                        {
                            "id": row["id"],
                            "session_id": row["session_id"],
                            "title": row["title"],
                            "ingredients": json.loads(row["ingredients"] or "[]"),
                            "steps": json.loads(row["steps"] or "[]"),
                            "source": row["source"],
                            "image_ref": row["image_ref"],
                            "created_at": row["created_at"],
                        }
                    )
                return recipes

        async with self._lock:
            return await asyncio.to_thread(_query)

    async def save_recipe(
        self, session_id: str, recipe_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        rec = dict(recipe_data)
        rec_id = rec.get("id") or str(uuid.uuid4())
        created_at = rec.get("created_at") or datetime.now(timezone.utc).isoformat()
        title = rec.get("title", "")
        ingredients = rec.get("ingredients", [])
        steps = rec.get("steps", [])
        source = rec.get("source", "manual")
        image_ref = rec.get("image_ref")

        ingredients_json = json.dumps(ingredients)
        steps_json = json.dumps(steps)

        def _execute():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO recipe_box (id, session_id, title, ingredients, steps, source, image_ref, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        session_id = excluded.session_id,
                        title = excluded.title,
                        ingredients = excluded.ingredients,
                        steps = excluded.steps,
                        source = excluded.source,
                        image_ref = excluded.image_ref,
                        created_at = excluded.created_at;
                    """,
                    (rec_id, session_id, title, ingredients_json, steps_json, source, image_ref, created_at),
                )
                conn.commit()

        async with self._lock:
            await asyncio.to_thread(_execute)

        return {
            "id": rec_id,
            "session_id": session_id,
            "title": title,
            "ingredients": ingredients,
            "steps": steps,
            "source": source,
            "image_ref": image_ref,
            "created_at": created_at,
        }

    async def delete_recipe(self, session_id: str, recipe_id: str) -> bool:
        def _execute():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM recipe_box WHERE session_id = ? AND id = ?",
                    (session_id, recipe_id),
                )
                conn.commit()
                return cursor.rowcount > 0

        async with self._lock:
            return await asyncio.to_thread(_execute)

    async def save_history(
        self, session_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        hist = dict(data)
        hist_id = hist.get("id") or str(uuid.uuid4())
        created_at = hist.get("created_at") or datetime.now(timezone.utc).isoformat()
        ingredients_used = hist.get("ingredients_used", [])
        constraint_text = hist.get("constraint_text") or hist.get("constraint")
        recipes = hist.get("recipes", [])
        cooked = hist.get("cooked")

        ingredients_used_json = json.dumps(ingredients_used)
        recipes_json = json.dumps(recipes)

        def _execute():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO history (id, session_id, ingredients_used, constraint_text, recipes, cooked, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (hist_id, session_id, ingredients_used_json, constraint_text, recipes_json, cooked, created_at),
                )
                conn.commit()

        async with self._lock:
            await asyncio.to_thread(_execute)

        return {
            "id": hist_id,
            "session_id": session_id,
            "ingredients_used": ingredients_used,
            "constraint_text": constraint_text,
            "recipes": recipes,
            "cooked": cooked,
            "created_at": created_at,
        }

    async def get_history(
        self, session_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        def _query():
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, session_id, ingredients_used, constraint_text, recipes, cooked, created_at
                    FROM history
                    WHERE session_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (session_id, limit),
                )
                rows = cursor.fetchall()
                history_list = []
                for row in rows:
                    history_list.append(
                        {
                            "id": row["id"],
                            "session_id": row["session_id"],
                            "ingredients_used": json.loads(row["ingredients_used"] or "[]"),
                            "constraint_text": row["constraint_text"],
                            "recipes": json.loads(row["recipes"] or "[]"),
                            "cooked": row["cooked"],
                            "created_at": row["created_at"],
                        }
                    )
                return history_list

        async with self._lock:
            return await asyncio.to_thread(_query)


class MongoBackend(StorageBackend):
    """MongoDB Atlas implementation of StorageBackend using PyMongo."""

    def __init__(self, mongo_uri: Optional[str] = None):
        import pymongo

        uri = mongo_uri or os.getenv("MONGO_URI")
        if not uri:
            raise ValueError("MONGO_URI is not set.")

        self.client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
        # Test connection
        self.client.admin.command("ping")
        self.db = self.client["simmer"]

        # Ensure collections and indexes
        self.db.pantries.create_index([("session_id", pymongo.ASCENDING)], unique=True)
        self.db.recipe_box.create_index(
            [("session_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]
        )
        self.db.history.create_index(
            [("session_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]
        )

    @property
    def backend_name(self) -> str:
        return "mongo"

    async def get_pantry(self, session_id: str) -> Optional[Dict[str, Any]]:
        def _op():
            doc = self.db.pantries.find_one({"session_id": session_id}, {"_id": 0})
            return doc

        return await asyncio.to_thread(_op)

    async def save_pantry(
        self, session_id: str, ingredients: List[str], dislikes: List[str]
    ) -> Dict[str, Any]:
        updated_at = datetime.now(timezone.utc).isoformat()
        doc = {
            "session_id": session_id,
            "ingredients": list(ingredients),
            "dislikes": list(dislikes),
            "updated_at": updated_at,
        }

        def _op():
            self.db.pantries.update_one(
                {"session_id": session_id},
                {"$set": doc},
                upsert=True,
            )

        await asyncio.to_thread(_op)
        return doc

    async def get_recipe_box(self, session_id: str) -> List[Dict[str, Any]]:
        def _op():
            cursor = self.db.recipe_box.find(
                {"session_id": session_id}, {"_id": 0}
            ).sort("created_at", -1)
            return list(cursor)

        return await asyncio.to_thread(_op)

    async def save_recipe(
        self, session_id: str, recipe_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        rec = dict(recipe_data)
        if not rec.get("id"):
            rec["id"] = str(uuid.uuid4())
        if not rec.get("created_at"):
            rec["created_at"] = datetime.now(timezone.utc).isoformat()
        rec["session_id"] = session_id
        rec.pop("_id", None)

        def _op():
            self.db.recipe_box.update_one(
                {"id": rec["id"], "session_id": session_id},
                {"$set": rec},
                upsert=True,
            )

        await asyncio.to_thread(_op)
        rec.pop("_id", None)
        return rec

    async def delete_recipe(self, session_id: str, recipe_id: str) -> bool:
        def _op():
            result = self.db.recipe_box.delete_one(
                {"session_id": session_id, "id": recipe_id}
            )
            return result.deleted_count > 0

        return await asyncio.to_thread(_op)

    async def save_history(
        self, session_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        hist = dict(data)
        if not hist.get("id"):
            hist["id"] = str(uuid.uuid4())
        if not hist.get("created_at"):
            hist["created_at"] = datetime.now(timezone.utc).isoformat()
        hist["session_id"] = session_id
        hist.pop("_id", None)

        def _op():
            self.db.history.insert_one(dict(hist))

        await asyncio.to_thread(_op)
        hist.pop("_id", None)
        return hist

    async def get_history(
        self, session_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        def _op():
            cursor = (
                self.db.history.find({"session_id": session_id}, {"_id": 0})
                .sort("created_at", -1)
                .limit(limit)
            )
            return list(cursor)

        return await asyncio.to_thread(_op)


class InMemoryBackend(StorageBackend):
    """In-memory dictionary fallback backend."""

    def __init__(self):
        self._pantries: Dict[str, Dict[str, Any]] = {}
        self._recipe_box: Dict[str, Dict[str, Any]] = {}
        self._history: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    @property
    def backend_name(self) -> str:
        return "memory"

    async def get_pantry(self, session_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            doc = self._pantries.get(session_id)
            return dict(doc) if doc else None

    async def save_pantry(
        self, session_id: str, ingredients: List[str], dislikes: List[str]
    ) -> Dict[str, Any]:
        updated_at = datetime.now(timezone.utc).isoformat()
        doc = {
            "session_id": session_id,
            "ingredients": list(ingredients),
            "dislikes": list(dislikes),
            "updated_at": updated_at,
        }
        async with self._lock:
            self._pantries[session_id] = doc
        return dict(doc)

    async def get_recipe_box(self, session_id: str) -> List[Dict[str, Any]]:
        async with self._lock:
            items = [
                dict(rec)
                for rec in self._recipe_box.values()
                if rec.get("session_id") == session_id
            ]
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return items

    async def save_recipe(
        self, session_id: str, recipe_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        rec = dict(recipe_data)
        if not rec.get("id"):
            rec["id"] = str(uuid.uuid4())
        if not rec.get("created_at"):
            rec["created_at"] = datetime.now(timezone.utc).isoformat()
        rec["session_id"] = session_id

        async with self._lock:
            self._recipe_box[rec["id"]] = rec
        return dict(rec)

    async def delete_recipe(self, session_id: str, recipe_id: str) -> bool:
        async with self._lock:
            rec = self._recipe_box.get(recipe_id)
            if rec and rec.get("session_id") == session_id:
                del self._recipe_box[recipe_id]
                return True
            return False

    async def save_history(
        self, session_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        hist = dict(data)
        if not hist.get("id"):
            hist["id"] = str(uuid.uuid4())
        if not hist.get("created_at"):
            hist["created_at"] = datetime.now(timezone.utc).isoformat()
        hist["session_id"] = session_id

        async with self._lock:
            self._history.append(hist)
        return dict(hist)

    async def get_history(
        self, session_id: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        async with self._lock:
            items = [
                dict(h)
                for h in self._history
                if h.get("session_id") == session_id
            ]
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return items[:limit]


_storage_singleton: Optional[StorageBackend] = None


def get_storage(force_reinit: bool = False) -> StorageBackend:
    """Storage factory that initializes the appropriate backend based on DB_BACKEND.

    Tries MongoDB if configured, falls back to SQLite, then falls back to InMemory.
    """
    global _storage_singleton
    if _storage_singleton is not None and not force_reinit:
        return _storage_singleton

    configured_backend = os.getenv("DB_BACKEND", "sqlite").strip().lower()
    logger.info(f"Initializing storage with preferred backend: {configured_backend}")

    # 1. Try MongoDB if requested
    if configured_backend == "mongo":
        try:
            mongo_backend = MongoBackend()
            logger.info("Successfully connected to MongoDB Atlas.")
            _storage_singleton = mongo_backend
            return _storage_singleton
        except Exception as exc:
            logger.warning(
                f"Failed to connect to MongoDB ({exc}). Falling back to SQLite backend."
            )

    # 2. Try SQLite if requested or as fallback from mongo
    if configured_backend in ("sqlite", "mongo"):
        try:
            sqlite_backend = SqliteBackend()
            logger.info("Successfully initialized SQLite storage (simmer.db).")
            _storage_singleton = sqlite_backend
            return _storage_singleton
        except Exception as exc:
            logger.warning(
                f"Failed to initialize SQLite storage ({exc}). Falling back to InMemoryBackend."
            )

    # 3. Fallback to InMemory
    logger.info("Using InMemoryBackend storage.")
    _storage_singleton = InMemoryBackend()
    return _storage_singleton
