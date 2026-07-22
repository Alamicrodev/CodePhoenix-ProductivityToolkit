from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib import error, request
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import get_settings
from app.models.habit import Habit
from app.models.task import Task
from app.schemas.ai_scheduler import AiSchedulerItem, AiSchedulerResponse
from app.services.focus_sessions import list_focus_sessions
from app.services.habits import list_habits
from app.services.tasks import list_tasks


logger = logging.getLogger(__name__)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _resolve_timezone(time_zone: str | None) -> timezone | ZoneInfo:
    if not time_zone:
        return timezone.utc

    try:
        return ZoneInfo(time_zone)
    except ZoneInfoNotFoundError:
        return timezone.utc


def _now_local(current_time: datetime | None, time_zone: str | None) -> datetime:
    tzinfo = _resolve_timezone(time_zone)
    reference = _ensure_utc(current_time or datetime.now(timezone.utc))
    return reference.astimezone(tzinfo)


def _js_day_of_week(date_time: datetime) -> int:
    return (date_time.weekday() + 1) % 7


def _start_of_day(date_time: datetime) -> datetime:
    return date_time.replace(hour=0, minute=0, second=0, microsecond=0)


def _add_days(date_time: datetime, amount: int) -> datetime:
    return date_time + timedelta(days=amount)


def _parse_date_only(value: str) -> datetime:
    year, month, day = (int(part) for part in value.split("-"))
    return datetime(year, month, day)


def _parse_time(value: str) -> tuple[int, int]:
    hours, minutes = (int(part) for part in value.split(":"))
    return hours, minutes


def _format_clock_12(date_time: datetime) -> str:
    hours = date_time.hour
    minutes = date_time.minute
    period = "PM" if hours >= 12 else "AM"
    display_hour = hours % 12 or 12
    return f"{display_hour}:{minutes:02d} {period}"


def _format_relative_day_label(date_time: datetime, now: datetime) -> str:
    day = _start_of_day(date_time)
    today = _start_of_day(now)
    diff_days = (day.date() - today.date()).days

    if diff_days == 0:
        return "Today"
    if diff_days == 1:
        return "Tomorrow"
    if -6 <= diff_days <= 6:
        return date_time.strftime("%a")
    return f"{date_time.strftime('%a, %b')} {date_time.day}"


def _is_active_day(habit: Habit, date_time: datetime) -> bool:
    active_days = habit.active_days or []
    return not active_days or _js_day_of_week(date_time) in active_days


def _has_completion_on_date(habit: Habit, target_day: datetime) -> bool:
    target_key = target_day.date().isoformat()
    return any(entry[:10] == target_key for entry in habit.completed_dates)


def _current_week_completion(habit: Habit, now: datetime) -> bool:
    week_start = _start_of_day(now) - timedelta(days=_js_day_of_week(now))
    week_end = week_start + timedelta(days=7)
    for marker in habit.completed_dates:
        try:
            completed_at = _ensure_utc(datetime.fromisoformat(marker.replace("Z", "+00:00"))).astimezone(now.tzinfo)
        except ValueError:
            continue
        if week_start <= completed_at < week_end:
            return True
    return False


def _habit_availability_label(habit: Habit, now: datetime) -> str:
    today = _start_of_day(now)

    if habit.frequency == "hourly":
        if _is_active_day(habit, now) and habit.active_hours_start and habit.active_hours_end:
            start_hour, start_minute = _parse_time(habit.active_hours_start)
            end_hour, end_minute = _parse_time(habit.active_hours_end)
            start = today.replace(hour=start_hour, minute=start_minute)
            end = today.replace(hour=end_hour, minute=end_minute)
            if end <= start:
                end = end + timedelta(days=1)
            if start <= now < end and not _has_completion_on_date(habit, now):
                remaining_minutes = max(1, round((end - now).total_seconds() / 60))
                if remaining_minutes < 60:
                    return f"Available now · Due in {remaining_minutes} min"
                hours = round(remaining_minutes / 60)
                return f"Available now · Due in {hours} hour{'s' if hours != 1 else ''}"

        for offset in range(1, 15):
            candidate = _add_days(today, offset)
            if _is_active_day(habit, candidate):
                if habit.active_hours_start:
                    hour, minute = _parse_time(habit.active_hours_start)
                    candidate = candidate.replace(hour=hour, minute=minute)
                return f"Next window: {_format_relative_day_label(candidate, now)} {_format_clock_12(candidate)}"

        return "Next window: soon"

    if habit.frequency == "daily":
        if _is_active_day(habit, now) and not _has_completion_on_date(habit, today):
            return "Available now · Due today"

        for offset in range(1, 31):
            candidate = _add_days(today, offset)
            if _is_active_day(habit, candidate):
                return f"Next window: {_format_relative_day_label(candidate, now)}"

        return "Next window: soon"

    if not _current_week_completion(habit, now):
        return "Available now · Due this week"

    for offset in range(1, 31):
        candidate = _add_days(today, offset)
        if candidate.weekday() == 6:
            return f"Next window: {_format_relative_day_label(candidate, now)}"

    return "Next window: soon"


def _task_due_detail(task: Task, now: datetime) -> str | None:
    if not task.due_date:
        return None

    due_day = _parse_date_only(task.due_date).replace(tzinfo=now.tzinfo)
    if task.due_time:
        hours, minutes = _parse_time(task.due_time)
        due_day = due_day.replace(hour=hours, minute=minutes)
        diff_minutes = round((due_day - now).total_seconds() / 60)
        if diff_minutes <= 0:
            return "Overdue"
        if diff_minutes < 60:
            return f"Due in {diff_minutes} min"
        hours_left = round(diff_minutes / 60)
        return f"Due in {hours_left} hour{'s' if hours_left != 1 else ''}"

    day_start = _start_of_day(now)
    tomorrow = _add_days(day_start, 1)
    week_end = _add_days(day_start, 7)

    if due_day == day_start:
        return "Due today"
    if due_day == tomorrow:
        return "Due tomorrow"
    if day_start < due_day <= week_end:
        return "Due this week"
    return f"Due {due_day.strftime('%b')} {due_day.day}"


def _priority_rank(priority: str) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(priority, 3)


def _sort_key_for_task(task: Task) -> tuple[int, datetime, int]:
    if task.due_date:
        due_date = _parse_date_only(task.due_date)
    else:
        due_date = datetime.max
    due_time_rank = 0 if task.due_time else 1
    return (_priority_rank(task.priority), due_date, due_time_rank)


def _serialize_task(task: Task, now: datetime) -> dict[str, Any]:
    detail = _task_due_detail(task, now)
    if task.due_time:
        due_day = _parse_date_only(task.due_date or now.date().isoformat()).replace(tzinfo=now.tzinfo)
        hours, minutes = _parse_time(task.due_time)
        time_label = _format_clock_12(due_day.replace(hour=hours, minute=minutes))
    elif task.due_date:
        time_label = _format_relative_day_label(_parse_date_only(task.due_date).replace(tzinfo=now.tzinfo), now)
    else:
        time_label = "Anytime"

    return {
        "time": time_label,
        "title": task.title,
        "type": "task",
        "priority": task.priority,
        "duration": "60 min" if task.priority == "high" else "45 min" if task.priority == "medium" else "30 min",
        "detail": detail,
        "source_id": task.id,
        "source_type": "task",
    }


def _serialize_habit(habit: Habit, now: datetime) -> dict[str, Any]:
    availability = _habit_availability_label(habit, now)
    if availability.startswith("Available now"):
        time_label = "Now"
    elif availability.startswith("Next window: "):
        time_label = availability.removeprefix("Next window: ")
    else:
        time_label = availability

    return {
        "time": time_label,
        "title": habit.title,
        "type": "habit",
        "priority": "high" if habit.frequency == "hourly" else "medium",
        "duration": "30 min",
        "detail": availability,
        "source_id": habit.id,
        "source_type": "habit",
    }


def _build_baseline_items(tasks: list[Task], habits: list[Habit], now: datetime) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = [
        {
            "time": "9:00 AM",
            "title": "Morning planning session",
            "type": "planning",
            "priority": "medium",
            "duration": "30 min",
            "detail": "Set your day around the most important work first.",
            "source_type": "system",
        }
    ]

    active_tasks = [task for task in tasks if not task.completed and task.due_date]
    active_tasks.sort(key=_sort_key_for_task)
    items.extend(_serialize_task(task, now) for task in active_tasks[:4])

    active_habits = [habit for habit in habits if habit.frequency in {"hourly", "daily", "weekly"}]
    items.extend(_serialize_habit(habit, now) for habit in active_habits[:3])

    if active_tasks:
        items.append(
            {
                "time": "5:00 PM",
                "title": "Review and planning",
                "type": "review",
                "priority": "low",
                "duration": "30 min",
                "detail": "Leave a short buffer to review what moved and what slipped.",
                "source_type": "system",
            }
        )

    return items[:8]


def _extract_json_payload(content: str) -> dict[str, Any] | list[Any] | None:
    trimmed = content.strip()
    if not trimmed:
        return None

    if trimmed.startswith("```"):
        trimmed = trimmed.strip("`")
        trimmed = trimmed.removeprefix("json").strip()

    first_object = trimmed.find("{")
    first_array = trimmed.find("[")
    if first_object == -1 and first_array == -1:
        return None

    start_index = first_object if first_object != -1 and (first_object < first_array or first_array == -1) else first_array
    end_index = max(trimmed.rfind("}"), trimmed.rfind("]"))
    if end_index <= start_index:
        return None

    try:
        return json.loads(trimmed[start_index : end_index + 1])
    except json.JSONDecodeError:
        return None


def _build_scheduler_prompt(tasks: list[Task], habits: list[Habit], focus_sessions: list[Any], now: datetime) -> dict[str, Any]:
    active_tasks = [task for task in tasks if not task.completed and task.due_date]
    active_tasks.sort(key=_sort_key_for_task)
    active_habits = [habit for habit in habits if habit.frequency in {"hourly", "daily", "weekly"}]
    active_focus_sessions = [session for session in focus_sessions if session.status == "active"]

    return {
        "current_time": now.isoformat(),
        "time_zone": now.tzinfo.key if isinstance(now.tzinfo, ZoneInfo) else "UTC",
        "instructions": [
            "Return only valid JSON with keys summary and items.",
            "Keep every item grounded in the provided tasks, habits, and focus sessions.",
            "Prefer concise labels such as Today, Tomorrow, this week, Due in 30 min, or Now.",
            "Do not invent tasks or habits that are not in the input.",
            "Use a maximum of 8 items.",
        ],
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "priority": task.priority,
                "completed": task.completed,
                "due_date": task.due_date,
                "due_time": task.due_time,
                "tags": task.tags,
                "subtask_count": len(task.subtasks),
                "subtasks_completed": sum(1 for subtask in task.subtasks if subtask.completed),
            }
            for task in active_tasks[:10]
        ],
        "habits": [
            {
                "id": habit.id,
                "title": habit.title,
                "frequency": habit.frequency,
                "streak": habit.streak,
                "active_days": habit.active_days,
                "active_hours": habit.active_hours,
                "hourly_interval": habit.hourly_interval,
                "completed_dates": habit.completed_dates[-8:],
                "recent_occurrences": [
                    {"timestamp": occurrence.timestamp.isoformat(), "status": occurrence.status}
                    for occurrence in habit.occurrences[-8:]
                ],
            }
            for habit in active_habits[:6]
        ],
        "active_focus_sessions": [
            {
                "id": session.id,
                "title": session.title,
                "items": [
                    {"source_type": item.source_type, "source_id": item.source_id, "title": item.title}
                    for item in session.items
                ],
            }
            for session in active_focus_sessions[:3]
        ],
        "baseline_schedule": _build_baseline_items(tasks, habits, now),
    }


def _scheduler_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "items": {
                "type": "array",
                "minItems": 1,
                "maxItems": 8,
                "items": {
                    "type": "object",
                    "properties": {
                        "time": {"type": "string"},
                        "title": {"type": "string"},
                        "type": {"type": "string"},
                        "priority": {"type": "string"},
                        "duration": {"type": "string"},
                        "detail": {"type": ["string", "null"]},
                        "source_id": {"type": ["string", "null"]},
                        "source_type": {"type": ["string", "null"]},
                    },
                    "required": ["time", "title", "type", "priority", "duration"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["summary", "items"],
        "additionalProperties": False,
    }


def _extract_output_text(payload: Any) -> str | None:
    def _find_text(node: Any) -> str | None:
        if isinstance(node, dict):
            for key in ("output_text", "text"):
                value = node.get(key)
                if isinstance(value, str) and value.strip():
                    return value
            for value in node.values():
                found = _find_text(value)
                if found:
                    return found
        elif isinstance(node, list):
            for value in node:
                found = _find_text(value)
                if found:
                    return found
        return None

    if not isinstance(payload, dict):
        return None

    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    response = payload.get("response")
    if isinstance(response, dict):
        nested_output = response.get("output_text")
        if isinstance(nested_output, str) and nested_output.strip():
            return nested_output

    for key in ("candidates", "steps", "response", "responses", "data"):
        found = _find_text(payload.get(key))
        if found:
            return found

    return _find_text(payload)


def _call_gemini_scheduler(model: str, prompt: dict[str, Any], timeout_seconds: int, api_key: str) -> dict[str, Any] | None:
    body = json.dumps(
        {
            "model": model,
            "input": json.dumps(prompt, ensure_ascii=False),
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": _scheduler_output_schema(),
            },
        }
    ).encode("utf-8")

    req = request.Request(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        try:
            error_body = exc.read().decode("utf-8")
        except Exception:
            error_body = ""
        logger.warning("Gemini scheduler HTTP error: %s %s", exc.code, error_body[:1000])
        return None
    except (TimeoutError, error.URLError, json.JSONDecodeError) as exc:
        logger.warning("Gemini scheduler request failed: %s", exc)
        return None

    content = _extract_output_text(payload)
    if not isinstance(content, str):
        logger.warning("Gemini scheduler response missing output text: %s", list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__)
        return None

    parsed = _extract_json_payload(content)
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, list):
        return {"items": parsed}
    return None


def _normalize_items(items: list[dict[str, Any]]) -> list[AiSchedulerItem]:
    normalized: list[AiSchedulerItem] = []
    for item in items:
        try:
            normalized.append(AiSchedulerItem.model_validate(item))
        except Exception:
            continue
    return normalized[:8]


def build_ai_schedule(db, user_id: str, current_time: datetime | None = None, time_zone: str | None = None) -> AiSchedulerResponse:
    settings = get_settings()
    now = _now_local(current_time, time_zone)

    tasks = list_tasks(db, user_id)
    habits = list_habits(db, user_id)
    focus_sessions = list_focus_sessions(db, user_id)

    prompt = _build_scheduler_prompt(tasks, habits, focus_sessions, now)

    if settings.gemini_api_key:
        parsed = _call_gemini_scheduler(
            settings.scheduler_model,
            prompt,
            settings.scheduler_model_timeout_seconds,
            settings.gemini_api_key,
        )

        if isinstance(parsed, dict):
            items = parsed.get("items")
            summary = parsed.get("summary")
            if isinstance(items, list):
                normalized = _normalize_items([item for item in items if isinstance(item, dict)])
                if normalized:
                    return AiSchedulerResponse(
                        generated_at=now,
                        model=settings.scheduler_model,
                        fallback_used=False,
                        items=normalized,
                        summary=summary if isinstance(summary, str) else None,
                    )

    baseline = _normalize_items(_build_baseline_items(tasks, habits, now))
    return AiSchedulerResponse(
        generated_at=now,
        model=settings.scheduler_model if settings.gemini_api_key else "heuristic-fallback",
        fallback_used=True,
        items=baseline,
        summary="Generated from the live workspace snapshot because the hosted model was unavailable.",
    )
