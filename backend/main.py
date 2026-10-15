"""Simmer FastAPI Application.

Main entry point providing AI recipe recommendations, pantry management,
photo ingredient extraction, and screenshot recipe saving.
"""

from contextlib import asynccontextmanager
import logging
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Load environment variables early at module level
load_dotenv()

from ai_client import OllamaClient
from prompts import (
    PHOTO_INGREDIENTS_PROMPT,
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

@app.get("/api/health")
async def health_check():
    """Health check endpoint reporting API, database, and Ollama status."""
    ollama_ok = await ai_client.check_health()
    return {
        "status": "ok",
        "db_backend": storage.backend_name,
        "ollama": ollama_ok,
    }


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

        extracted = await ai_client.generate_with_image(
            prompt=PHOTO_INGREDIENTS_PROMPT,
            image_bytes=image_bytes,
        )

        # Normalize extracted result to a list of strings
        ingredients_list: List[str] = []
        if isinstance(extracted, list):
            ingredients_list = [str(item).strip() for item in extracted if str(item).strip()]
        elif isinstance(extracted, dict):
            # Model might return {"ingredients": [...]}
            if "ingredients" in extracted and isinstance(extracted["ingredients"], list):
                ingredients_list = [
                    str(item).strip()
                    for item in extracted["ingredients"]
                    if str(item).strip()
                ]
            else:
                # Collect any list found in dict values
                for val in extracted.values():
                    if isinstance(val, list):
                        ingredients_list.extend(
                            [str(item).strip() for item in val if str(item).strip()]
                        )
                        break

        return {"ingredients": ingredients_list}

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
async def suggest_recipes(body: SuggestRequest):
    """Generate recipe suggestions matching available ingredients and preferences."""
    try:
        ingredients_str = ", ".join(body.ingredients) if body.ingredients else "None"
        dislikes_str = ", ".join(body.dislikes) if body.dislikes else "None"
        constraint_str = body.constraint if body.constraint else "None"

        prompt = RECIPE_SYSTEM_PROMPT.format(
            ingredients=ingredients_str,
            dislikes=dislikes_str,
            constraint=constraint_str,
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
            session_id=body.session_id,
            ingredients=body.ingredients,
            dislikes=body.dislikes,
        )

        # Save suggestion run to history
        await storage.save_history(
            session_id=body.session_id,
            data={
                "ingredients_used": body.ingredients,
                "constraint_text": body.constraint,
                "recipes": recipes,
                "cooked": None,
            },
        )

        return {"recipes": recipes}

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
