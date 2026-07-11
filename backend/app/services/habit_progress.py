from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from app.models.habit import Habit


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_timestamp(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return _ensure_utc(parsed)


def _now(reference_time: datetime | None = None) -> datetime:
    return _ensure_utc(reference_time or datetime.now(timezone.utc))


def _js_day_of_week(date_time: datetime) -> int:
    # Match the frontend's getDay() contract: Sunday=0, Monday=1, ...
    return (date_time.weekday() + 1) % 7


def _start_of_day(date_time: datetime) -> datetime:
    return date_time.replace(hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(date_time: datetime) -> datetime:
    return date_time.replace(hour=23, minute=59, second=59, microsecond=999_999)


def _add_days(date_time: datetime, amount: int) -> datetime:
    return date_time + timedelta(days=amount)


def _start_of_week(date_time: datetime) -> datetime:
    # Match the frontend's Sunday-based week buckets.
    return _start_of_day(date_time) - timedelta(days=_js_day_of_week(date_time))


def _parse_time(value: str) -> time:
    hours, minutes = (int(piece) for piece in value.split(":"))
    return time(hour=hours, minute=minutes)


def _is_active_day(habit: Habit, date_time: datetime) -> bool:
    active_days = habit.active_days or []
    return not active_days or _js_day_of_week(date_time) in active_days


def _window_contains_timestamp(habit: Habit, start: datetime, end: datetime, timestamp: datetime) -> bool:
    if habit.frequency == "hourly":
        return start <= timestamp < end

    return start <= timestamp <= end


def _has_completion_in_range(habit: Habit, start: datetime, end: datetime) -> bool:
    for marker in habit.completed_dates:
        completed_at = _parse_timestamp(marker)
        if _window_contains_timestamp(habit, start, end, completed_at):
            return True

    return False


def _has_skip_in_range(habit: Habit, start: datetime, end: datetime) -> bool:
    for occurrence in habit.occurrences:
        if occurrence.status != "skipped":
            continue

        skipped_at = _ensure_utc(occurrence.timestamp)
        if _window_contains_timestamp(habit, start, end, skipped_at):
            return True

    return False


def _hourly_window_bounds(habit: Habit, date_time: datetime) -> tuple[datetime, datetime]:
    day_start = _start_of_day(date_time)

    if not habit.active_hours_start or not habit.active_hours_end:
        return day_start, _end_of_day(date_time)

    start_clock = _parse_time(habit.active_hours_start)
    end_clock = _parse_time(habit.active_hours_end)

    start = day_start.replace(hour=start_clock.hour, minute=start_clock.minute)
    end = day_start.replace(hour=end_clock.hour, minute=end_clock.minute)

    if end <= start:
        end = end + timedelta(days=1)

    return start, end


def _hourly_day_slots(habit: Habit, day: datetime, cutoff: datetime, created_at: datetime | None) -> list[tuple[datetime, datetime]]:
    interval_hours = habit.hourly_interval or 1
    slots: list[tuple[datetime, datetime]] = []
    slot_start, active_end = _hourly_window_bounds(habit, day)
    effective_cutoff = cutoff if cutoff < active_end else active_end

    while slot_start < active_end:
        slot_end = slot_start + timedelta(hours=interval_hours)
        bounded_end = slot_end if slot_end < active_end else active_end

        if created_at is not None and bounded_end <= created_at:
            slot_start = bounded_end
            if bounded_end >= active_end:
                break
            continue

        if slot_start <= effective_cutoff:
            slots.append((slot_start, bounded_end))
        else:
            break

        slot_start = bounded_end
        if bounded_end >= active_end:
            break

    return slots


def _daily_streak(habit: Habit, now: datetime) -> int:
    streak = 0
    day = _start_of_day(now)
    created_at = _start_of_day(habit.created_at) if habit.created_at else None

    while created_at is None or day >= created_at:
        if not _is_active_day(habit, day):
            day = _add_days(day, -1)
            continue

        slot_start = _start_of_day(day)
        slot_end = _end_of_day(day)

        if habit.created_at and slot_end <= habit.created_at:
            break

        completed = _has_completion_in_range(habit, slot_start, slot_end)
        skipped = not completed and _has_skip_in_range(habit, slot_start, slot_end)

        if completed:
            streak += 1
        elif skipped:
            break
        elif slot_end > now and streak == 0:
            day = _add_days(day, -1)
            continue
        else:
            break

        day = _add_days(day, -1)

    return streak


def _weekly_streak(habit: Habit, now: datetime) -> int:
    streak = 0
    week_start = _start_of_week(now)
    created_at = _start_of_week(habit.created_at) if habit.created_at else None

    while created_at is None or week_start >= created_at:
        week_end = _add_days(week_start, 7)

        if habit.created_at and week_end <= habit.created_at:
            break

        completed = _has_completion_in_range(habit, week_start, week_end)
        skipped = not completed and _has_skip_in_range(habit, week_start, week_end)

        if completed:
            streak += 1
        elif skipped:
            break
        elif week_end > now and streak == 0:
            week_start = _add_days(week_start, -7)
            continue
        else:
            break

        week_start = _add_days(week_start, -7)

    return streak


def _hourly_streak(habit: Habit, now: datetime) -> int:
    streak = 0
    day = _start_of_day(now)
    created_at = _start_of_day(habit.created_at) if habit.created_at else None

    while created_at is None or day >= created_at:
        if not _is_active_day(habit, day):
            day = _add_days(day, -1)
            continue

        cutoff = now if day.date() == now.date() else _end_of_day(day)
        day_slots = _hourly_day_slots(habit, day, cutoff, habit.created_at)

        for slot_start, slot_end in reversed(day_slots):
            completed = _has_completion_in_range(habit, slot_start, slot_end)
            skipped = not completed and _has_skip_in_range(habit, slot_start, slot_end)

            if completed:
                streak += 1
                continue

            if skipped:
                return streak

            if slot_end > now and streak == 0:
                continue

            return streak

        day = _add_days(day, -1)

    return streak


def _latest_completion_marker(habit: Habit) -> str | None:
    if not habit.completed_dates:
        return None

    if habit.frequency == "hourly":
        latest = max((_parse_timestamp(marker) for marker in habit.completed_dates), default=None)
        return latest.isoformat() if latest else None

    latest = max((_parse_timestamp(marker) for marker in habit.completed_dates), default=None)
    return latest.date().isoformat() if latest else None


def recalculate_habit_progress(habit: Habit, reference_time: datetime | None = None) -> Habit:
    now = _now(reference_time)

    if habit.frequency == "hourly":
        habit.streak = _hourly_streak(habit, now)
    elif habit.frequency == "daily":
        habit.streak = _daily_streak(habit, now)
    else:
        habit.streak = _weekly_streak(habit, now)

    habit.last_completed = _latest_completion_marker(habit)
    return habit
