/**
 * Simmer API Client
 * Connects to the backend at /api with error handling and session tracking.
 */

const BASE_URL = '/api';

/**
 * Helper to handle fetch responses and parse JSON cleanly.
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const errorMessage =
      (data && (data.error || data.detail || data.message)) ||
      `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Suggest 3 recipes for a meal, from ingredients, dislikes, and constraints.
 * POST /api/suggest
 */
export async function suggestRecipes(ingredients = [], dislikes = [], constraint = '', sessionId = '', meal = 'dinner') {
  try {
    const response = await fetch(`${BASE_URL}/suggest`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        ingredients,
        dislikes,
        constraint: constraint || null,
        meal,
        session_id: sessionId,
        sessionId,
      }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [suggestRecipes]:', error);
    throw error;
  }
}

/**
 * Extract ingredients from a fridge photo.
 * POST /api/ingredients-from-photo (FormData)
 */
export async function getIngredientsFromPhoto(imageFile, sessionId = '') {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('file', imageFile); // fallback alias for backends expecting 'file'
    formData.append('session_id', sessionId);
    formData.append('sessionId', sessionId);

    const response = await fetch(`${BASE_URL}/ingredients-from-photo`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId,
      },
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [getIngredientsFromPhoto]:', error);
    throw error;
  }
}

/**
 * Save/extract a recipe from an uploaded screenshot.
 * POST /api/save-from-screenshot (FormData)
 */
export async function saveFromScreenshot(imageFile, sessionId = '') {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('file', imageFile); // fallback alias
    formData.append('session_id', sessionId);
    formData.append('sessionId', sessionId);

    const response = await fetch(`${BASE_URL}/save-from-screenshot`, {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId,
      },
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [saveFromScreenshot]:', error);
    throw error;
  }
}

/**
 * Fetch pantry items and dislikes for the session.
 * GET /api/pantry
 */
export async function getPantry(sessionId = '') {
  try {
    const url = new URL(`${window.location.origin}${BASE_URL}/pantry`);
    if (sessionId) {
      url.searchParams.set('session_id', sessionId);
      url.searchParams.set('sessionId', sessionId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Session-ID': sessionId,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [getPantry]:', error);
    throw error;
  }
}

/**
 * Persist ingredients and dislikes in the user's pantry.
 * POST /api/pantry
 */
export async function savePantry(sessionId = '', ingredients = [], dislikes = []) {
  try {
    const response = await fetch(`${BASE_URL}/pantry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        session_id: sessionId,
        sessionId,
        ingredients,
        dislikes,
      }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [savePantry]:', error);
    throw error;
  }
}

/**
 * Fetch saved recipes for the session.
 * GET /api/recipe-box
 */
export async function getRecipeBox(sessionId = '') {
  try {
    const url = new URL(`${window.location.origin}${BASE_URL}/recipe-box`);
    if (sessionId) {
      url.searchParams.set('session_id', sessionId);
      url.searchParams.set('sessionId', sessionId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Session-ID': sessionId,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [getRecipeBox]:', error);
    throw error;
  }
}

/**
 * Delete a recipe from the recipe box.
 * DELETE /api/recipe-box/{id}
 */
export async function deleteRecipe(recipeId, sessionId = '') {
  try {
    const url = new URL(`${window.location.origin}${BASE_URL}/recipe-box/${encodeURIComponent(recipeId)}`);
    if (sessionId) {
      url.searchParams.set('session_id', sessionId);
      url.searchParams.set('sessionId', sessionId);
    }

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Session-ID': sessionId,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('API Error [deleteRecipe]:', error);
    throw error;
  }
}

/**
 * Check backend server health.
 * GET /api/health
 */
/**
 * Load the kitchen session from Mongo. The response sets the session cookie.
 * GET /api/session
 * One shared request so a remount cannot create a second session.
 */
let sessionRequest = null;

export function getSession() {
  if (!sessionRequest) {
    sessionRequest = fetch(`${BASE_URL}/session`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(handleResponse)
      .catch((error) => {
        sessionRequest = null;
        throw error;
      });
  }
  return sessionRequest;
}

/**
 * Remember that this browser opened the kitchen.
 * POST /api/session/enter
 */
export async function markEntered() {
  const response = await fetch(`${BASE_URL}/session/enter`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

export async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.warn('API Health Check failed:', error);
    return { status: 'down', error: error.message };
  }
}
