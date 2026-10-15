"""Simmer FastAPI Application.

Main entry point providing AI recipe recommendations, pantry management,
photo ingredient extraction, and screenshot recipe saving.
"""

from contextlib import asynccontextmanager
import logging
import os
from typing import Any, Dict, List, Optional
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Load environment variables early at module level
load_dotenv()

from ai_client import OllamaClient
from prompts import (
    MEAL_GUIDANCE,
    PHOTO_INGREDIENTS_PROMPT,
    PHOTO_SCENE_PROMPT,
    RECIPE_SYSTEM_PROMPT,
    SCREENSHOT_RECIPE_PROMPT,
)
from storage import StorageBackend, get_storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("simmer")
FREE_SUGGESTIONS = 3
SESSION_COOKIE = "simmer_session"
NOT_FOOD_MESSAGE = "This photo isn't a fridge or ingredients. Snap the shelves, or type what you have."
_FOOD_SCENE_WORDS = frozenset(
    {
        "food",
        "fridge",
        "refrigerator",
        "pantry",
        "kitchen",
        "counter",
        "shelf",
        "shelves",
        "plate",
        "bowl",
        "ingredient",
        "ingredients",
        "vegetable",
        "vegetables",
        "fruit",
        "fruits",
        "grocery",
        "groceries",
        "produce",
        "meal",
    }
)
_SCREEN_SCENE_WORDS = frozenset(
    {
        "screen",
        "screenshot",
        "document",
        "chat",
        "editor",
        "terminal",
        "browser",
        "laptop",
        "monitor",
        "code",
    }
)


def _scene_is_food(sentence: str) -> bool:
    cleaned = "".join(ch if ch.isalpha() else " " for ch in sentence.lower())
    words = set(cleaned.split())
    if words & _SCREEN_SCENE_WORDS:
        return False
    return bool(words & _FOOD_SCENE_WORDS)

# Initialize AI client and Storage singleton
ai_client = OllamaClient()
storage: StorageBackend = get_storage()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown procedures."""
    logger.info("Starting up Simmer backend application...")
    logger.info(f"Storage backend active: {storage.backend_name}")
    logger.info(f"Ollama target URL: {ai_client.base_url}")
    logger.info(f"Ollama target Model: {ai_client.model}")

    # Check Ollama connectivity at startup
    ollama_ready = await ai_client.check_health()
    if ollama_ready:
        logger.info("Ollama is reachable and responding.")
    else:
        logger.warning(
            f"Ollama is not reachable at {ai_client.base_url}. "
            "Model calls may fail until Ollama is started."
        )

    yield

    logger.info("Shutting down Simmer backend application...")


app = FastAPI(
    title="Simmer API",
    description="Backend API for Simmer, a fridge-to-dinner cooking assistant.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------

class SuggestRequest(BaseModel):
    session_id: Optional[str] = Field(None, alias="sessionId", description="Unique user session ID")
    ingredients: List[str] = Field(default_factory=list, description="Available pantry ingredients")
    dislikes: List[str] = Field(default_factory=list, description="Ingredients user dislikes or avoids")
    constraint: Optional[str] = Field(
        None, description="Optional cooking constraint ('15-min', 'spicy', 'one-pot', 'veg', etc.)"
    )
    meal: Optional[str] = Field(
        None, description="Meal to cook: breakfast, lunch, snack, or dinner"
    )

    class Config:
        populate_by_name = True


class PantrySaveRequest(BaseModel):
    session_id: Optional[str] = Field(None, alias="sessionId", description="Unique user session ID")
    ingredients: List[str] = Field(default_factory=list, description="Pantry ingredients list")
    dislikes: List[str] = Field(default_factory=list, description="Disliked ingredients list")

    class Config:
        populate_by_name = True


class RecipeItem(BaseModel):
    name: str
    time_min: int
    difficulty: str
    uses: List[str]
    need_to_buy: List[str]
    steps: List[str]
    tip: str


# ---------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": exc.detail},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc: Exception):
    logger.exception(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "error": str(exc),
        },
    )


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

def _session_view(record: Dict[str, Any]) -> Dict[str, Any]:
    used = int(record.get("free_uses") or 0)
    return {
        "session_id": record["session_id"],
        "entered": bool(record.get("entered")),
        "free_uses": used,
        "free_uses_remaining": max(0, FREE_SUGGESTIONS - used),
    }


def _with_session_cookie(payload: Dict[str, Any], session_id: str) -> JSONResponse:
    response = JSONResponse(payload)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
        path="/",
    )
    return response


def _resolve_session_id(request: Request, explicit: Optional[str] = None) -> str:
    if explicit:
        return explicit
    cookie_id = request.cookies.get(SESSION_COOKIE)
    if cookie_id:
        return cookie_id
    return str(uuid.uuid4())


@app.get("/api/health")
async def health_check():
    """Health check endpoint reporting API, database, and Ollama status."""
    ollama_ok = await ai_client.check_health()
    return {
        "status": "ok",
        "db_backend": storage.backend_name,
        "ollama": ollama_ok,
    }


@app.get("/api/session")
async def get_session(request: Request):
    """Load or create the kitchen session stored in Mongo."""
    session_id = _resolve_session_id(request)
    record = await storage.get_or_create_session(session_id)
    return _with_session_cookie(_session_view(record), record["session_id"])


@app.post("/api/session/enter")
async def enter_session(request: Request):
    """Remember that this browser opened the kitchen."""
    session_id = _resolve_session_id(request)
    record = await storage.mark_entered(session_id)
    return _with_session_cookie(_session_view(record), record["session_id"])


@app.post("/api/ingredients-from-photo")
async def ingredients_from_photo(
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
):
    """Analyze a photo of fridge or pantry contents to extract food ingredients."""
    upload_file = image or file
    if upload_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided. Please upload an image file using field 'image' or 'file'.",
        )

    try:
        image_bytes = await upload_file.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded image file is empty.",
            )

        scene = await ai_client.generate_with_image(
            prompt=PHOTO_SCENE_PROMPT,
            image_bytes=image_bytes,
            as_json=False,
        )
        if not isinstance(scene, str) or not _scene_is_food(scene):
            logger.info("Photo rejected as not food: %s", scene)
            return {
                "is_food": False,
                "ingredients": [],
                "message": NOT_FOOD_MESSAGE,
            }

        extracted = await ai_client.generate_with_image(
            prompt=PHOTO_INGREDIENTS_PROMPT,
            image_bytes=image_bytes,
        )

        raw_items: List[Any] = []
        if isinstance(extracted, dict) and isinstance(extracted.get("ingredients"), list):
            raw_items = extracted["ingredients"]
        elif isinstance(extracted, list):
            raw_items = extracted

        ingredients_list: List[str] = []
        seen = set()
        for item in raw_items:
            name = str(item).strip().lower()
            if not name or name in seen:
                continue
            seen.add(name)
            ingredients_list.append(name)
            if len(ingredients_list) >= 12:
                break

        if not ingredients_list:
            return {
                "is_food": False,
                "ingredients": [],
                "message": NOT_FOOD_MESSAGE,
            }

        return {"is_food": True, "ingredients": ingredients_list}

    except HTTPException:
        raise
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama AI service is currently unreachable. Please verify Ollama is running.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI model timed out while analyzing the image. Please try again.",
        ) from exc
    except Exception as exc:
        logger.error(f"Error analyzing photo: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract ingredients from photo: {str(exc)}",
        ) from exc


@app.post("/api/suggest")
async def suggest_recipes(body: SuggestRequest, request: Request):
    """Generate recipe suggestions matching available ingredients and preferences."""
    session_id = _resolve_session_id(request, body.session_id)
    record = await storage.get_or_create_session(session_id)
    if int(record.get("free_uses") or 0) >= FREE_SUGGESTIONS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Free meals used. The year is ₹99.",
        )

    try:
        ingredients_str = ", ".join(body.ingredients) if body.ingredients else "None"
        dislikes_str = ", ".join(body.dislikes) if body.dislikes else "None"
        constraint_str = body.constraint if body.constraint else "None"
        meal_key = (body.meal or "dinner").strip().lower()
        if meal_key not in MEAL_GUIDANCE:
            meal_key = "dinner"

        prompt = RECIPE_SYSTEM_PROMPT.format(
            ingredients=ingredients_str,
            dislikes=dislikes_str,
            constraint=constraint_str,
            meal=meal_key,
            meal_guidance=MEAL_GUIDANCE[meal_key],
        )

        model_response = await ai_client.generate_text(prompt)

        # Extract recipes list from parsed response
        recipes: List[Dict[str, Any]] = []
        if isinstance(model_response, dict):
            recipes = model_response.get("recipes", [])
        elif isinstance(model_response, list):
            recipes = model_response

        # Auto-save current pantry
        await storage.save_pantry(
            session_id=session_id,
            ingredients=body.ingredients,
            dislikes=body.dislikes,
        )

        # Save suggestion run to history
        await storage.save_history(
            session_id=session_id,
            data={
                "ingredients_used": body.ingredients,
                "constraint_text": f"{meal_key}; {body.constraint or ''}".strip("; "),
                "recipes": recipes,
                "cooked": None,
            },
        )

        if recipes:
            record = await storage.increment_free_uses(session_id)

        return _with_session_cookie(
            {
                "recipes": recipes,
                "free_uses_remaining": max(0, FREE_SUGGESTIONS - int(record.get("free_uses") or 0)),
            },
            session_id,
        )

    except HTTPException:
        raise
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama AI service is currently unreachable. Please verify Ollama is running.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI recipe generation timed out. Please try again.",
        ) from exc
    except Exception as exc:
        logger.error(f"Error generating recipes: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipes: {str(exc)}",
        ) from exc


@app.post("/api/save-from-screenshot")
async def save_from_screenshot(
    session_id: Optional[str] = Form(None),
    sessionId: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
):
    """Extract a recipe from a screenshot and save it into the user's recipe box."""
    effective_session_id = session_id or sessionId
    if not effective_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )

    upload_file = image or file
    if upload_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No screenshot image file provided.",
        )

    try:
        image_bytes = await upload_file.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded screenshot image file is empty.",
            )

        extracted = await ai_client.generate_with_image(
            prompt=SCREENSHOT_RECIPE_PROMPT,
            image_bytes=image_bytes,
        )

        if not isinstance(extracted, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Model did not return a valid recipe structure.",
            )

        # Check for model error response (e.g. {"error": "no recipe"})
        if "error" in extracted and extracted["error"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not extract recipe: {extracted['error']}",
            )

        recipe_data = {
            "title": extracted.get("title") or "Screenshot Recipe",
            "ingredients": extracted.get("ingredients") or [],
            "steps": extracted.get("steps") or [],
            "source": "screenshot",
        }

        saved_recipe = await storage.save_recipe(
            session_id=effective_session_id,
            recipe_data=recipe_data,
        )

        return {"recipe": saved_recipe}

    except HTTPException:
        raise
    except ConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama AI service is currently unreachable. Please verify Ollama is running.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI model timed out while processing the recipe screenshot.",
        ) from exc
    except Exception as exc:
        logger.error(f"Error saving from screenshot: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract and save recipe from screenshot: {str(exc)}",
        ) from exc


@app.get("/api/pantry")
async def get_pantry(
    session_id: Optional[str] = None,
    sessionId: Optional[str] = None,
):
    """Retrieve the current pantry ingredients and dislikes for the session."""
    effective_session_id = session_id or sessionId
    if not effective_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )
    try:
        pantry = await storage.get_pantry(effective_session_id)
        if pantry is None:
            return {
                "session_id": effective_session_id,
                "ingredients": [],
                "dislikes": [],
                "updated_at": None,
            }
        return pantry
    except Exception as exc:
        logger.error(f"Error fetching pantry for session {effective_session_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pantry: {str(exc)}",
        ) from exc


@app.post("/api/pantry")
async def save_pantry(body: PantrySaveRequest):
    """Save or update pantry ingredients and dislikes."""
    effective_session_id = body.session_id or "default-session"
    try:
        updated = await storage.save_pantry(
            session_id=effective_session_id,
            ingredients=body.ingredients,
            dislikes=body.dislikes,
        )
        return updated
    except Exception as exc:
        logger.error(f"Error saving pantry for session {effective_session_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save pantry: {str(exc)}",
        ) from exc


@app.get("/api/recipe-box")
async def get_recipe_box(
    session_id: Optional[str] = None,
    sessionId: Optional[str] = None,
):
    """Retrieve all saved recipes from the user's recipe box."""
    effective_session_id = session_id or sessionId
    if not effective_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )
    try:
        recipes = await storage.get_recipe_box(effective_session_id)
        return {"recipes": recipes}
    except Exception as exc:
        logger.error(f"Error fetching recipe box for session {effective_session_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recipe box: {str(exc)}",
        ) from exc


@app.delete("/api/recipe-box/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    session_id: Optional[str] = None,
    sessionId: Optional[str] = None,
):
    """Delete a recipe from the user's recipe box."""
    effective_session_id = session_id or sessionId
    if not effective_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )
    try:
        deleted = await storage.delete_recipe(
            session_id=effective_session_id,
            recipe_id=recipe_id,
        )
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe '{recipe_id}' not found in recipe box for this session.",
            )
        return {
            "success": True,
            "message": "Recipe deleted successfully",
            "id": recipe_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error deleting recipe {recipe_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete recipe: {str(exc)}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
