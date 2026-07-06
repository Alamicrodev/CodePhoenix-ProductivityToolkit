from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.habit import Habit, HabitOccurrence
from app.schemas.habits import HabitCreate, HabitUpdate

#Get habbits by userId
def list_habits(db: Session, user_id: str) -> list[Habit]:
    stmt = select(Habit).where(Habit.user_id == user_id).options(selectinload(Habit.occurrences)).order_by(Habit.created_at.desc())
    return list(db.scalars(stmt).unique())   #db.scalars returns an interable of habit objects, we convert it into a list


#Get a single habit
def get_habit_or_404(db: Session, user_id: str, habit_id: str) -> Habit:
    stmt = select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id).options(selectinload(Habit.occurrences))
    habit = db.scalar(stmt) #gets the single habit object
    if not habit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Habit not found")
    return habit

#Create Habit
def create_habit(db: Session, user_id: str, payload: HabitCreate) -> Habit:
    active_hours = payload.active_hours   #we need to first make sure active_hours exist in the created habit
    habit = Habit(
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        frequency=payload.frequency,                       #hourly, daily, weekly etc.
        hourly_interval=payload.hourly_interval,           #if hourly? how many hours per interval
        active_hours_start=active_hours.start if active_hours else None,    #if active_hours? active hours start time
        active_hours_end=active_hours.end if active_hours else None,        #if active_hours? active hours end time 
        active_days=payload.active_days,                                    #days the habit is active
        streak=payload.streak,                                              #habit streak (in occurrences) 
        last_completed=payload.last_completed,                                 
        completed_dates=payload.completed_dates,
        occurrences=[HabitOccurrence(timestamp=item.timestamp, status=item.status) for item in payload.occurrences],
    )
    db.add(habit)
    db.commit()
    return get_habit_or_404(db, user_id, habit.id)

#Update Habit 
def update_habit(db: Session, habit: Habit, payload: HabitUpdate) -> Habit:
    update_data = payload.model_dump(exclude_unset=True, exclude={"active_hours", "occurrences"})
    #converts object to disctionary removing none values and excluding active_hours and occurences. 

    for field, value in update_data.items():
        setattr(habit, field, value)             #updates attributes in given habit object from the created dictionary. 

    if payload.active_hours is not None:
        habit.active_hours_start = payload.active_hours.start         #updates habit active hours
        habit.active_hours_end = payload.active_hours.end

    if payload.occurrences is not None:                               #if there are occurences replaces previous occurrences list with new one. 
        habit.occurrences = [HabitOccurrence(timestamp=item.timestamp, status=item.status) for item in payload.occurrences]

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)


#Mark habit as complete
def complete_habit(db: Session, habit: Habit, timestamp: datetime | None = None) -> Habit:
    completion_time = timestamp or datetime.now(timezone.utc)   #takes the passed in time otherwise uses the current time.
    today = completion_time.date().isoformat()  #isoformat converts it from date object to a string eg "2026-07-01"
    completion_marker = completion_time.isoformat() if habit.frequency == "hourly" else today  #isoformat converts it from datetime object to a string eg "2026-07-01T14:30:45" 

    if completion_marker not in habit.completed_dates:    #if not already completed at that time/date
        habit.completed_dates = [*habit.completed_dates, completion_marker]  #destructure previous list and add the new completion marker
        habit.last_completed = today        
        habit.streak += 1
        habit.occurrences.append(HabitOccurrence(timestamp=completion_time, status="completed"))

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)     #we get and return the updated habbit

#Undo habit completion
def undo_habit_completion(db: Session, habit: Habit, completion_timestamp: str) -> Habit:
    habit.completed_dates = [item for item in habit.completed_dates if item != completion_timestamp]  #updates completed_dates with a new list removing the given completion timestamp. 
    if habit.streak > 0:     #reduce streak by 1 
        habit.streak -= 1

    habit.occurrences = [             #updates habit.occurrences with a new list, removes the occurence where status was completed and its timestamp was equal to the given timestamp.
        occ for occ in habit.occurrences
        if not (
            occ.status == "completed"
            and (occ.timestamp.isoformat() == completion_timestamp or occ.timestamp.date().isoformat() == completion_timestamp)
        )
    ]
    habit.last_completed = habit.completed_dates[-1][:10] if habit.completed_dates else None #updates last completed by getting from last value of completed dates.

    db.add(habit)
    db.commit()
    return get_habit_or_404(db, habit.user_id, habit.id)

#Delete Habit
def delete_habit(db: Session, habit: Habit) -> None:
    db.delete(habit)
    db.commit()
