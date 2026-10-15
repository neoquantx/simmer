"""Ollama AI Client for Simmer.

Handles communication with Ollama API for text generation and vision tasks,
including robust JSON extraction and error handling.
"""

import base64
import json
import logging
import os
import re
from typing import Any, Optional, Union

import httpx

logger = logging.getLogger(__name__)


def extract_json(raw_text: str) -> Union[dict, list, Any]:
    """Robustly extract and parse JSON from model output.

    Handles direct JSON, markdown code blocks (```json ... ```),
    and JSON embedded within conversational text.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Model returned an empty response.")

    text = raw_text.strip()

    # 1. Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Try markdown code fences (```json ... ``` or ``` ... ```)
    fence_pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
    matches = fence_pattern.findall(text)
    for match in matches:
        cleaned = match.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            sub = _find_json_substring(cleaned)
            if sub is not None:
                return sub

    # 3. Find outermost JSON object {...} or array [...]
    sub = _find_json_substring(text)
    if sub is not None:
        return sub

    raise ValueError(f"Could not extract valid JSON from model response: {text[:200]}")


def _find_json_substring(text: str) -> Optional[Union[dict, list]]:
    """Scan text to find and parse the outermost JSON object or array."""
    first_brace = text.find("{")
    first_bracket = text.find("[")

    candidates = []
    if first_brace != -1:
        last_brace = text.rfind("}")
        if last_brace > first_brace:
            candidates.append((first_brace, last_brace + 1))

    if first_bracket != -1:
        last_bracket = text.rfind("]")
        if last_bracket > first_bracket:
            candidates.append((first_bracket, last_bracket + 1))

    # Prioritize whichever starts earlier
    candidates.sort(key=lambda span: span[0])

    for start, end in candidates:
        candidate = text[start:end].strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    return None


class OllamaClient:
    """Asynchronous client for interacting with the Ollama API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 120.0,
    ):
        raw_base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.base_url = raw_base_url.rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "gemma3:4b")
        self.timeout = httpx.Timeout(timeout, connect=10.0)

    async def check_health(self) -> bool:
        """Check if Ollama server is reachable."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(4.0)) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception as exc:
            logger.debug(f"Ollama health check failed: {exc}")
            return False

    async def generate_text(self, prompt: str) -> Union[dict, list, Any]:
        """Generate text from a prompt and extract parsed JSON object/list."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }

        url = f"{self.base_url}/api/generate"
        logger.info(f"Calling Ollama generate (text) at {url} using model '{self.model}'")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.ConnectError as exc:
            logger.error(f"Cannot connect to Ollama at {self.base_url}: {exc}")
            raise ConnectionError(
                f"Failed to connect to Ollama at {self.base_url}. Please ensure Ollama is running."
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error(f"Ollama request timed out after {self.timeout}s: {exc}")
            raise TimeoutError("Ollama generation timed out after 120 seconds.") from exc
        except httpx.HTTPStatusError as exc:
            logger.error(f"Ollama returned HTTP error: {exc.response.status_code} - {exc.response.text}")
            raise RuntimeError(
                f"Ollama returned error {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except Exception as exc:
            logger.error(f"Unexpected error calling Ollama: {exc}")
            raise RuntimeError(f"Ollama generation failed: {exc}") from exc

        raw_output = data.get("response", "")
        return extract_json(raw_output)

    async def generate_with_image(
        self, prompt: str, image_bytes: bytes, as_json: bool = True
    ) -> Union[dict, list, str, Any]:
        """Generate text given an image and prompt.

        Returns parsed JSON by default. Set as_json=False for the raw sentence.
        """
        if not image_bytes:
            raise ValueError("No image data provided.")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [b64_image],
            "stream": False,
        }

        url = f"{self.base_url}/api/generate"
        logger.info(
            f"Calling Ollama generate (vision) at {url} using model '{self.model}' with {len(image_bytes)} bytes"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.ConnectError as exc:
            logger.error(f"Cannot connect to Ollama at {self.base_url}: {exc}")
            raise ConnectionError(
                f"Failed to connect to Ollama at {self.base_url}. Please ensure Ollama is running."
            ) from exc
        except httpx.TimeoutException as exc:
            logger.error(f"Ollama vision request timed out: {exc}")
            raise TimeoutError("Ollama vision generation timed out after 120 seconds.") from exc
        except httpx.HTTPStatusError as exc:
            logger.error(f"Ollama returned HTTP error: {exc.response.status_code} - {exc.response.text}")
            raise RuntimeError(
                f"Ollama returned error {exc.response.status_code}: {exc.response.text}"
            ) from exc
        except Exception as exc:
            logger.error(f"Unexpected error calling Ollama vision: {exc}")
            raise RuntimeError(f"Ollama vision generation failed: {exc}") from exc

        raw_output = data.get("response", "")
        if not as_json:
            return raw_output.strip()
        return extract_json(raw_output)
