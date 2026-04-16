import os
import re
from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI
from groq import Groq

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "whisper-large-v3")

# initialize groq client (will use provided key)
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else Groq()

def transcribe_audio(audio_path):
    """Transcribe audio using the Groq Speech-to-Text SDK instead of local Whisper."""
    print(f"[transcribe_audio] Starting transcription for: {audio_path}")
    print(f"[transcribe_audio] GROQ_API_KEY exists: {bool(GROQ_API_KEY)}")
    print(f"[transcribe_audio] GROQ_MODEL: {GROQ_MODEL}")

    if not GROQ_API_KEY:
        error_msg = "Transcription failed: GROQ_API_KEY not set in environment."
        print(f"[transcribe_audio] ERROR: {error_msg}")
        return error_msg

    try:
        # Check if file exists and get size
        if not os.path.exists(audio_path):
            error_msg = f"Transcription failed: Audio file not found at {audio_path}"
            print(f"[transcribe_audio] ERROR: {error_msg}")
            return error_msg

        file_size = os.path.getsize(audio_path)
        print(f"[transcribe_audio] File size: {file_size} bytes ({file_size / (1024*1024):.2f} MB)")

        # Groq has a 25MB file size limit
        if file_size > 25 * 1024 * 1024:
            error_msg = "Transcription failed: File size exceeds 25MB limit"
            print(f"[transcribe_audio] ERROR: {error_msg}")
            return error_msg

        with open(audio_path, "rb") as f:
            file_content = f.read()
            print(f"[transcribe_audio] Read {len(file_content)} bytes from file")

            if len(file_content) == 0:
                error_msg = "Transcription failed: Audio file is empty (0 bytes)"
                print(f"[transcribe_audio] ERROR: {error_msg}")
                return error_msg

            print(f"[transcribe_audio] Sending request to Groq API...")
            # Use tuple format: (filename, file_content)
            transcription = groq_client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), file_content),
                model=GROQ_MODEL,
                temperature=0,
                response_format="verbose_json",
            )
            print(f"[transcribe_audio] Received response from Groq API")

        # Try common access patterns from the SDK/playground
        # 1) transcription.text (playground example)
        text = getattr(transcription, "text", None)
        if isinstance(text, str) and text.strip():
            return text.strip()

        # 2) dict-like access
        try:
            j = dict(transcription)
        except Exception:
            j = None

        if isinstance(j, dict):
            if "text" in j and isinstance(j["text"], str):
                return j["text"].strip()
            if "transcript" in j and isinstance(j["transcript"], str):
                return j["transcript"].strip()
            # results/data fallbacks
            if "results" in j and isinstance(j["results"], list):
                texts = []
                for r in j["results"]:
                    if isinstance(r, dict):
                        t = r.get("text") or r.get("transcript")
                        if t:
                            texts.append(t)
                if texts:
                    return " ".join(texts).strip()
            if "data" in j and isinstance(j["data"], dict):
                t = j["data"].get("text") or j["data"].get("transcript")
                if isinstance(t, str) and t.strip():
                    return t.strip()

        # fallback: try attribute access for nested structures
        try:
            raw = getattr(transcription, "raw", None) or getattr(transcription, "__dict__", None)
            if isinstance(raw, dict):
                for key in ("text", "transcript"):
                    v = raw.get(key)
                    if isinstance(v, str) and v.strip():
                        return v.strip()
        except Exception:
            pass

        # as last resort return stringified transcription
        result = str(transcription)
        print(f"[transcribe_audio] WARNING: Falling back to stringified result: {result[:100]}...")
        return result
    except Exception as e:
        error_msg = f"Transcription failed: {str(e)}"
        print(f"[transcribe_audio] EXCEPTION: {error_msg}")
        import traceback
        traceback.print_exc()
        return error_msg

def summarize_text(text):
    """Summarize text using GPT-4o-mini. Return a placeholder for empty text and
    catch API errors to avoid causing a 400/500 response in the Flask route."""
    if not text or not text.strip():
        return "No transcript available to summarize."
    prompt = f"Summarize this conversation in 3 short bullet points:\n\n{text}"
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        # Return a short error message so the caller can handle/display it.
        return f"Summary failed: {str(e)}"

def meeting_notes_text(text):
    """Generate meeting notes including attendees, action items, decisions and concise bullets."""
    if not text or not text.strip():
        return "No transcript available to generate meeting notes."
    prompt = (
        "You are a meeting assistant. Produce meeting notes from the transcript below. "
        "Include: key decisions, action items with owners (if present), and a concise bullet list of highlights. "
        "Use bullets and clear headings.\n\nTranscript:\n\n" + text
    )
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Meeting notes generation failed: {str(e)}"

def generate_title_from_transcript(text, min_words=2, max_words=4, prefer_existing=False):
    """
    Generate a short, meaningful title (2–4 words) from the given transcript text.

    - Uses the module-level `client` (OpenAI) for efficiency.
    - Accepts `prefer_existing` for backward compatibility with app.py.
    - Returns the AI-generated title, or "Untitled" if generation fails.
    """
    import re

    try:
        # --- Step 1: Handle prefer_existing heuristic ---
        if prefer_existing and isinstance(text, str):
            t = text.strip()
            if t and '\n' not in t and len(t.split()) <= max_words and len(t) < (max_words * 12):
                # Looks like a usable existing title
                cleaned = re.sub(r'["“”]', '', " ".join(t.split()))
                return cleaned or "Untitled"

        # --- Step 2: Validate input ---
        if not text or not isinstance(text, str) or not text.strip():
            return "Untitled"

        # --- Step 3: Build AI prompt ---
        prompt = (
            f"You are an expert summarizer. "
            f"Read the transcript below and output EXACTLY ONE short, natural-sounding title "
            f"of {min_words}-{max_words} words. Output ONLY the title, no punctuation or quotes.\n\n"
            f"Transcript:\n{text}\n\nTitle:"
        )

        # --- Step 4: Call OpenAI model ---
        # Use max_tokens (correct param) and keep temperature low for consistent short titles.
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.35,
            max_tokens=60,
        )

        # --- Step 5: Extract model output safely ---
        title = ""
        try:
            # primary: object-style access (choices -> message -> content)
            if resp and getattr(resp, "choices", None):
                choice0 = resp.choices[0]
                # try choice0.message.content
                msg = getattr(choice0, "message", None)
                if msg:
                    title = getattr(msg, "content", "") or ""
                else:
                    # fallback: maybe choice0 has 'text' or dict-like 'message'
                    title = getattr(choice0, "text", "") or ""
        except Exception:
            title = ""

        if not title:
            # try dict-like access
            try:
                j = dict(resp)
                title = j.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
            except Exception:
                title = ""

        # --- Step 6: Clean and normalize ---
        title = (title.splitlines()[0] if title else "").strip()
        title = re.sub(r'["“”]', '', title)
        title = " ".join(title.split())

        # Debug print (useful during testing)
        print(f"[generate_title_from_transcript] AI raw title: {repr(title)}")

        if not title:
            return "Untitled"

        words = title.split()

        # --- Step 7: Handle short/long titles gracefully ---
        if len(words) > max_words:
            title = " ".join(words[:max_words])

        # Accept shorter-than-min titles instead of rejecting them
        return title or "Untitled"

    except Exception as e:
        print(f"[generate_title_from_transcript] ERROR: {e}")
        return "Untitled"




def main_points_text(text, max_points=5):
    """Generate a concise list of main points (top N) from the transcript.

    Returns numbered lines (1., 2., ...) or a short error string on failure.
    """
    if not text or not text.strip():
        return "No transcript available to generate main points."

    prompt = (
        "You are an assistant that extracts the most important points from a meeting or conversation.\n\n"
        f"From the transcript below, produce up to {max_points} numbered main points. "
        "Each point should be a single concise sentence (no more than ~20 words). "
        "Do not add any extra commentary, headings, or filler. Output the points as numbered lines.\n\n"
        "Transcript:\n\n"
        f"{text}\n\nMain points:"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        # safe extraction of assistant text
        try:
            out = completion.choices[0].message.content.strip()
        except Exception:
            try:
                j = dict(completion)
                out = j.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            except Exception:
                out = None

        if not out:
            return "Main points generation returned no text."
        return out

    except Exception as e:
        return f"Main points generation failed: {str(e)}"

def todo_list_text(transcript, max_items=6):
    """
    Generate actionable to-do items from `transcript`.
    - Try to extract real actions for long transcripts.
    - If none found (or transcript is short), produce inferred 'suggested' actions.
    - Always returns at least one helpful item (marked '(Suggested)' when inferred).
    """
    if not transcript or not transcript.strip():
        return "No transcript available to generate a to-do list."

    transcript = transcript.strip()
    is_short = len(transcript) < 200

    # Helper to call model
    def call_model(prompt, temperature=0.0, max_tokens=300):
        try:
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            return f"To-do list generation failed: {str(e)}"

    # Strict extraction prompt (for longer transcripts)
    strict_prompt = (
        "You are an assistant that extracts ACTIONABLE to-do items from the meeting transcript below.\n\n"
        "IMPORTANT: Only output items that are clearly present or directly implied in the transcript. "
        "Do NOT invent tasks, owners, or due dates that are not mentioned. "
        "If no actionable items are present, reply exactly: 'No action items found.' "
        f"Output up to {max_items} numbered lines, each concise (Action — Owner — Due date if mentioned).\n\n"
        "Transcript:\n\n"
        f"{transcript}\n\n"
        "To-do list:"
    )

    # Inference prompt (for short/reflective transcripts or fallback)
    infer_prompt = (
        "The following transcript may be short, reflective, or conceptual. "
        "Create a short to-do list of practical, actionable steps someone could take based on the ideas expressed. "
        "Focus on concrete actions (self-improvement, next steps, or project-oriented tasks). "
        "If an item is inferred rather than directly stated, append '(Suggested)'. "
        f"Output up to {max_items} concise one-line tasks.\n\n"
        "Transcript:\n\n"
        f"{transcript}\n\n"
        "To-Do List:"
    )

    # 1) If long, try strict extraction first
    result_text = ""
    if not is_short:
        result_text = call_model(strict_prompt, temperature=0.0)
        # If model returned the explicit 'No action items found.' or empty, treat as empty
        if not result_text or "no action items found" in result_text.lower():
            result_text = ""

    # 2) If short or strict returned nothing, call inference prompt
    if is_short or not result_text:
        # allow some creativity for inferred tasks
        result_text = call_model(infer_prompt, temperature=0.3)

    # If still empty or an error string, provide a small default fallback
    if not result_text or result_text.lower().startswith("to-do list generation failed"):
        # Create a few heuristic suggested items using transcript keywords
        # Extract a few meaningful words from the transcript for context
        keywords = re.findall(r"\b[A-Za-z]{4,}\b", transcript)
        keywords = list(dict.fromkeys([w.lower() for w in keywords]))[:3]  # first 3 unique words
        fallback_lines = []
        fallback_lines.append("Reflect on the main idea and pick one small action to try. (Suggested)")
        if keywords:
            fallback_lines.append(f"Use these keywords for focus: {', '.join(keywords)}. (Suggested)")
        fallback_lines.append("Try one concrete step this week and review progress. (Suggested)")
        return "\n".join(fallback_lines[:max_items])

    # --- Post-process model output into lines ---
    lines = [l.strip() for l in result_text.splitlines() if l.strip()]

    # If model returned a paragraph, try splitting on numbered bullets or sentences
    if len(lines) == 1 and len(lines[0]) > 200:
        # attempt to split by numbered list tokens or sentences
        possible = re.split(r"\n|(?<=\.)\s+", result_text)
        lines = [p.strip() for p in possible if p.strip()]

    # Validate and mark suggested items where overlap is low
    transcript_words = set(re.findall(r"\b\w{4,}\b", transcript.lower()))
    validated = []
    for line in lines:
        # remove leading numbering like "1." or "1)"
        line_clean = re.sub(r'^\s*\d+[\.\)]\s*', '', line).strip()
        if len(line_clean) < 3:
            continue
        words = set(re.findall(r"\b\w{4,}\b", line_clean.lower()))
        overlap = words & transcript_words
        if len(overlap) == 0 and "(Suggested)" not in line_clean:
            line_clean = f"{line_clean} (Suggested)"
        validated.append(line_clean)

    # If nothing validated, return small fallback suggestions
    if not validated:
        return (
            "1. Reflect on this message and pick one concrete action to try. (Suggested)\n"
            "2. Journal for 5–10 minutes about what this means for you. (Suggested)\n"
            "3. Share one insight with someone you trust. (Suggested)"
        )

    # Limit items and return
    return "\n".join(validated[:max_items])

def generate_email_draft_text(transcript, tone="neutral", recipient=None):
    """
    Generate a short email draft:
    Bold 'Subject:' label, subject text in normal weight,
    then one blank line and the email body.
    """
    if not transcript or not transcript.strip():
        return "No transcript available to generate an email."

    prompt = (
        "You are an assistant that writes concise professional email drafts based on meeting transcripts.\n"
        "Output the email in two parts:\n"
        "1. Subject line: a short, clear summary (no more than 8 words)\n"
        "2. Body: a concise 2–4 sentence paragraph summarizing purpose and next steps.\n\n"
        "Format exactly like this:\n"
        "Subject: <short subject line>\n\n"
        "<email body paragraph>\n\n"
        "Do NOT include any greetings or signatures.\n"
        f"Keep tone {tone}.\n\n"
        "Transcript:\n\n" + transcript + "\n\n"
        "Email:"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=400
        )
        out = completion.choices[0].message.content.strip()

        # Split subject and body
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        subject_line = ""
        body = ""

        for i, line in enumerate(lines):
            if line.lower().startswith("subject:"):
                subject_line = line.split(":", 1)[1].strip()
                body = " ".join(lines[i + 1 :]).strip()
                break

        if not subject_line:
            # fallback if model forgot label
            subject_line = lines[0] if lines else "Follow up"
            body = " ".join(lines[1:]) if len(lines) > 1 else ""

        # Build HTML output
        return f"<b>Subject:</b> {subject_line}<br><br>{body}"

    except Exception as e:
        return f"Email draft generation failed: {str(e)}"



def clean_transcript_text(transcript):
    """
    Polish and tidy up a raw transcript using AI. Automatically fixes punctuation,
    capitalization, and grammar; removes disfluencies and filler words; and makes
    the text read like professionally edited notes while preserving the original
    meaning and content.
    """
    if not transcript or not transcript.strip():
        return "No transcript available to clean."

    prompt = (
        "You are a professional transcript editor. Your job is to polish this raw transcript "
        "and make it read like professionally edited notes. Follow these guidelines:\n\n"
        "1. Fix punctuation, capitalization, and grammar\n"
        "2. Remove disfluencies and filler words (um, uh, like, you know, etc.)\n"
        "3. Remove repetitions, false starts, and stuttering\n"
        "4. Improve sentence flow and readability\n"
        "5. Make the text clear and professionally written\n\n"
        "IMPORTANT: Preserve all original meaning and content. Only tidy up the presentation. "
        "Do not summarize or omit any information — just make it read better.\n\n"
        f"Raw Transcript:\n\n{transcript}"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Transcript cleanup failed: {str(e)}"

def ask_ai_about_transcript(transcript, question):
    """
    Answer a question about the given transcript using AI.

    Args:
        transcript (str): The transcription text to analyze
        question (str): The user's question about the transcript

    Returns:
        str: AI-generated answer to the question
    """
    if not transcript or not transcript.strip():
        return "No transcript available to answer questions about."

    if not question or not question.strip():
        return "Please provide a question."

    prompt = (
        "You are an AI assistant helping users understand their transcribed recordings. "
        "A user has asked a question about their transcript. Answer their question clearly, "
        "accurately, and concisely based on the information in the transcript.\n\n"
        "If the transcript doesn't contain enough information to answer the question, "
        "say so politely and suggest what information might be missing.\n\n"
        f"Transcript:\n{transcript}\n\n"
        f"User Question: {question}\n\n"
        "Answer:"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Failed to answer question: {str(e)}"