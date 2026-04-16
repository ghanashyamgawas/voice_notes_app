"""
Utilities for splitting text into chunks for embedding and semantic search.
"""

from typing import List, Dict, Any
import re


def split_into_chunks(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    separator: str = "\n"
) -> List[str]:
    """
    Split text into overlapping chunks for embedding.

    Args:
        text: The text to split
        chunk_size: Target number of words per chunk
        overlap: Number of words to overlap between chunks
        separator: Preferred split points (default: newline)

    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []

    # Split into sentences/paragraphs
    # Try to split on paragraphs first, then sentences
    if separator == "\n":
        parts = text.split("\n")
    else:
        # Split on sentence boundaries
        parts = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current_chunk = []
    current_word_count = 0

    for part in parts:
        part = part.strip()
        if not part:
            continue

        words = part.split()
        word_count = len(words)

        # If adding this part exceeds chunk_size, save current chunk
        if current_word_count > 0 and current_word_count + word_count > chunk_size:
            # Save current chunk
            chunk_text = " ".join(current_chunk)
            if chunk_text:
                chunks.append(chunk_text)

            # Start new chunk with overlap
            if overlap > 0 and len(current_chunk) > 0:
                # Keep last 'overlap' words from previous chunk
                overlap_words = " ".join(current_chunk).split()[-overlap:]
                current_chunk = overlap_words
                current_word_count = len(overlap_words)
            else:
                current_chunk = []
                current_word_count = 0

        # Add current part to chunk
        current_chunk.append(part)
        current_word_count += word_count

    # Add final chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        if chunk_text:
            chunks.append(chunk_text)

    return chunks


def create_chunks_with_metadata(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50
) -> List[Dict[str, Any]]:
    """
    Create chunks with metadata (index, word count, etc.)

    Args:
        text: The text to split
        chunk_size: Target number of words per chunk
        overlap: Number of words to overlap between chunks

    Returns:
        List of dictionaries with 'text', 'index', 'word_count', 'char_count'
    """
    chunks = split_into_chunks(text, chunk_size=chunk_size, overlap=overlap)

    result = []
    for i, chunk_text in enumerate(chunks):
        words = chunk_text.split()
        result.append({
            'text': chunk_text,
            'index': i,
            'word_count': len(words),
            'char_count': len(chunk_text)
        })

    return result


def estimate_chunk_count(text: str, chunk_size: int = 500) -> int:
    """
    Estimate how many chunks will be created from text.

    Args:
        text: The text to estimate
        chunk_size: Target chunk size in words

    Returns:
        Estimated number of chunks
    """
    if not text or not text.strip():
        return 0

    words = text.split()
    word_count = len(words)

    # Rough estimate accounting for overlap
    estimated_chunks = max(1, (word_count // chunk_size) + 1)
    return estimated_chunks
