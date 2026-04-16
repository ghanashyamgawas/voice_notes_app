"""
Utilities for generating and managing text embeddings using OpenAI.
"""

import os
from typing import List, Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Default embedding model (upgraded to 3-small for 5x cost savings + better quality)
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536  # text-embedding-3-small produces 1536-dimensional vectors


def get_embedding(
    text: str,
    model: str = DEFAULT_EMBEDDING_MODEL
) -> Optional[List[float]]:
    """
    Generate an embedding vector for the given text using OpenAI.

    Args:
        text: The text to embed
        model: The OpenAI embedding model to use

    Returns:
        List of floats representing the embedding vector, or None on error
    """
    if not text or not text.strip():
        return None

    try:
        # Clean and truncate text if needed
        # OpenAI has a token limit (~8191 tokens for ada-002)
        text = text.strip()

        # Truncate to approximately 8000 tokens worth of text (~32,000 characters)
        if len(text) > 32000:
            text = text[:32000]

        response = client.embeddings.create(
            input=text,
            model=model
        )

        embedding = response.data[0].embedding
        return embedding

    except Exception as e:
        print(f"[Embedding] Error generating embedding: {e}")
        return None


def get_embeddings_batch(
    texts: List[str],
    model: str = DEFAULT_EMBEDDING_MODEL
) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts in a batch (more efficient).

    Args:
        texts: List of texts to embed
        model: The OpenAI embedding model to use

    Returns:
        List of embedding vectors (same order as input texts)
    """
    if not texts:
        return []

    try:
        # Clean texts
        cleaned_texts = []
        for text in texts:
            if text and text.strip():
                t = text.strip()
                # Truncate if needed
                if len(t) > 32000:
                    t = t[:32000]
                cleaned_texts.append(t)
            else:
                cleaned_texts.append("")

        # Get embeddings in batch
        response = client.embeddings.create(
            input=cleaned_texts,
            model=model
        )

        # Extract embeddings in order
        embeddings = []
        for i, item in enumerate(response.data):
            if cleaned_texts[i]:
                embeddings.append(item.embedding)
            else:
                embeddings.append(None)

        return embeddings

    except Exception as e:
        print(f"[Embedding] Error generating batch embeddings: {e}")
        # Return None for all on error
        return [None] * len(texts)


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.

    Args:
        vec1: First vector
        vec2: Second vector

    Returns:
        Cosine similarity score (0 to 1, higher is more similar)
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    # Calculate dot product
    dot_product = sum(a * b for a, b in zip(vec1, vec2))

    # Calculate magnitudes
    mag1 = sum(a * a for a in vec1) ** 0.5
    mag2 = sum(b * b for b in vec2) ** 0.5

    if mag1 == 0 or mag2 == 0:
        return 0.0

    return dot_product / (mag1 * mag2)


def estimate_embedding_cost(num_tokens: int, model: str = DEFAULT_EMBEDDING_MODEL) -> float:
    """
    Estimate the cost of generating embeddings.

    Args:
        num_tokens: Number of tokens to embed
        model: The embedding model

    Returns:
        Estimated cost in USD
    """
    # Pricing as of 2024 (update as needed)
    if model == "text-embedding-ada-002":
        cost_per_1k_tokens = 0.0001  # $0.0001 per 1K tokens
    elif model == "text-embedding-3-small":
        cost_per_1k_tokens = 0.00002  # $0.00002 per 1K tokens (5x cheaper!)
    elif model == "text-embedding-3-large":
        cost_per_1k_tokens = 0.00013  # $0.00013 per 1K tokens
    else:
        cost_per_1k_tokens = 0.00002  # Default to 3-small pricing (current default)

    return (num_tokens / 1000) * cost_per_1k_tokens
