import pandas as pd
import numpy as np
from datetime import datetime, timedelta
 
# -----------------------------
# CONFIG
# -----------------------------
PROD_FILE = "data/production_data.csv"
ALERT_FILE = "data/alerts_quality.csv"
FORECAST_FILE = "data/forecast_data.csv"
TASK_FILE = "data/tasks_schedule.csv"
 
plants = [
    "Dearborn", "Chicago", "Detroit", "Kansas City",
    "Louisville", "Valencia", "Cologne", "Chennai",
    "Pune", "Sanand"
]
 
models = [
    "F-150", "Mustang", "Explorer", "Escape", "Edge",
    "Ranger", "Bronco", "Expedition", "Fusion", "Mach-E"
]
 
departments = [
    "Assembly", "Paint Shop", "Body Shop",
    "Quality Check", "Logistics"
]
 
teams = ["Team 1", "Team 2", "Team 3", "Team 4"]
 
# -----------------------------
# HELPERS
# -----------------------------
def get_week(date):
    return f"W{date.isocalendar().week:02d}"
 
def get_quarter(month):
    return f"Q{(month-1)//3 + 1}"
 
# -----------------------------
# LOAD DATA
# -----------------------------
prod = pd.read_csv(PROD_FILE)
alerts = pd.read_csv(ALERT_FILE)
forecast = pd.read_csv(FORECAST_FILE)
tasks = pd.read_csv(TASK_FILE)
 
prod["date"] = pd.to_datetime(prod["date"], format="mixed")
 
last_date = prod["date"].max()
today = datetime.now().date()
 
# Generate list of days from last_date + 1 to today
current_date = (last_date + timedelta(days=1)).date() if isinstance(last_date, pd.Timestamp) else last_date + timedelta(days=1)
days_to_update = []

while current_date <= today:
    # Include all days (including weekends)
    days_to_update.append(current_date)
    current_date += timedelta(days=1)

# Generate list of next 7 weekdays for future forecast
forecast_dates = []
chk_date = today + timedelta(days=1)
while len(forecast_dates) < 7:
    # Include all days
    forecast_dates.append(chk_date)
    chk_date += timedelta(days=1)

# If no days to update, exit
if not days_to_update:
    print("❌ No days to update")
    exit(0)

# -----------------------------
# 1. PRODUCTION UPDATE
# -----------------------------
new_prod = []
 
for update_date in days_to_update:
    for plant in plants:
        for model in models:
           
            base = 160 + (models.index(model) * 5)
           
            # plant variation
            plant_factor = 1 + (plants.index(plant) * 0.02)
           
            units = int(base * plant_factor * np.random.uniform(0.95, 1.05))
            revenue = units * 500
           
            dept = np.random.choice(departments)
           
            # Add random time to the date
            hour = np.random.randint(6, 22)
            minute = np.random.randint(0, 60)
            second = np.random.randint(0, 60)
            timestamp = update_date.strftime(f"%Y-%m-%d {hour:02d}:{minute:02d}:{second:02d}")
           
            new_prod.append([
                timestamp,
                get_week(pd.Timestamp(update_date)),
                update_date.month,
                get_quarter(update_date.month),
                plant,
                dept,
                model,
                units,
                revenue
            ])
 
new_prod_df = pd.DataFrame(new_prod, columns=prod.columns)
prod = pd.concat([prod, new_prod_df], ignore_index=True)
prod.to_csv(PROD_FILE, index=False)
 
print(f"✅ Production updated for {len(days_to_update)} day(s)")
 
# -----------------------------
# 2. ALERTS (TIED TO PRODUCTION)
# -----------------------------
new_alerts = []
 
for _, row in new_prod_df.iterrows():
   
    # probability of alert based on production volume
    if np.random.rand() < 0.6:
       
        affected = int(row["units"] * np.random.uniform(0.05, 0.15))
       
        severity = np.random.choice(
            ["low", "medium", "high"],
            p=[0.3, 0.4, 0.3]
        )
       
        status = np.random.choice(
            ["active", "resolved"],
            p=[0.6, 0.4]
        )
       
        issue = np.random.choice([
            "machine",
            "quality",
            "equipment failure",
            "safety",
            "inspection failure"
        ])
       
        new_alerts.append([
            row["date"],
            row["week"],
            row["plant"],
            row["department"],
            row["model"],
            issue,
            severity,
            affected,
            status
        ])
 
new_alerts_df = pd.DataFrame(new_alerts, columns=alerts.columns)
alerts = pd.concat([alerts, new_alerts_df], ignore_index=True)
alerts.to_csv(ALERT_FILE, index=False)
 
print(f"✅ Alerts updated ({len(new_alerts_df)} alert records)")
 
# -----------------------------
# 3. FORECAST (ROLLING AVG + WEEKLY UPDATE)
# -----------------------------
# use last 7 days avg per model
recent = prod.tail(7 * len(plants) * len(models))
 
forecast_rows = []
 
for update_date in forecast_dates:
    for plant in plants:
        for model in models:
           
            subset = recent[
                (recent["plant"] == plant) &
                (recent["model"] == model)
            ]
           
            if len(subset) == 0:
                continue
           
            avg_units = subset["units"].mean()
           
            # slight upward trend
            forecast_units = int(avg_units * np.random.uniform(1.01, 1.05))
            forecast_revenue = forecast_units * 500
           
            # Add random time to the date
            hour = np.random.randint(6, 22)
            minute = np.random.randint(0, 60)
            second = np.random.randint(0, 60)
            timestamp = update_date.strftime(f"%Y-%m-%d {hour:02d}:{minute:02d}:{second:02d}")
           
            forecast_rows.append([
                timestamp,
                get_week(pd.Timestamp(update_date)),
                plant,
                np.random.choice(departments),
                model,
                forecast_units,
                forecast_revenue
            ])
 
new_forecast_df = pd.DataFrame(forecast_rows, columns=forecast.columns)
forecast = pd.concat([forecast, new_forecast_df], ignore_index=True)

# -----------------------------
# AUTOMATIC CLEANUP: Remove past and current day from forecast
# -----------------------------
forecast["Date"] = pd.to_datetime(forecast["Date"], format="mixed")
forecast = forecast[forecast["Date"].dt.date > today]

# Drop duplicates and save
forecast = forecast.drop_duplicates(subset=["Date", "Plant", "Model"])
forecast.to_csv(FORECAST_FILE, index=False)
 
print(f"✅ Forecast updated ({len(new_forecast_df)} forecast records)")
 
# -----------------------------
# 4. TASKS UPDATE
# -----------------------------
new_tasks = []
 
for update_date in days_to_update:
    for plant in plants:
       
        if np.random.rand() < 0.5:
           
            dept = np.random.choice(departments)
           
            task = np.random.choice([
                "Calibration", "Inspection", "Repair",
                "Optimization", "Audit", "Upgrade"
            ])
           
            priority = np.random.choice(
                ["low", "medium", "high"],
                p=[0.2, 0.5, 0.3]
            )
           
            status = np.random.choice([
                "scheduled", "in progress", "completed", "delayed"
            ])
           
            issue_type = np.random.choice([
                "machine", "quality", "safety"
            ])
           
            # Add random time to the date
            hour = np.random.randint(6, 22)
            minute = np.random.randint(0, 60)
            second = np.random.randint(0, 60)
            timestamp = update_date.strftime(f"%Y-%m-%d {hour:02d}:{minute:02d}:{second:02d}")
           
            new_tasks.append([
                f"T{len(tasks)+len(new_tasks)+1}",
                timestamp,
                get_week(pd.Timestamp(update_date)),
                plant,
                dept,
                task,
                "maintenance",
                priority,
                status,
                np.random.choice(teams),
                issue_type
            ])
 
new_tasks_df = pd.DataFrame(new_tasks, columns=tasks.columns)
tasks = pd.concat([tasks, new_tasks_df], ignore_index=True)
tasks.to_csv(TASK_FILE, index=False)
 
print(f"✅ Tasks updated ({len(new_tasks_df)} task records)")
 
print(f"🎯 ALL DATASETS UPDATED FOR {len(days_to_update)} DAY(S) ({days_to_update[0].strftime('%Y-%m-%d')} TO {days_to_update[-1].strftime('%Y-%m-%d')})")