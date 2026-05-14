"""
VOXA Medical Dataset Generator — 2.37 Crore (23.7M) Interconnected Data Points
===============================================================================
FAST version: uses pandas/numpy bulk vectorized ops, writes directly to DuckDB.
Only small analytics JSON files are written to disk for the agent.
"""

import json, time, logging
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import duckdb

SCRIPT_DIR = Path(__file__).parent.resolve()
DATA_DIR = SCRIPT_DIR.parent.parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(message)s")
log = logging.getLogger("gen")

# ── Reference Data ──
FIRST_M = ["James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles",
            "Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua"]
FIRST_F = ["Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
            "Lisa","Nancy","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna","Michelle"]
LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
        "Hernandez","Lopez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee",
        "Perez","Thompson","White","Harris","Clark","Lewis","Robinson","Walker","Young","King"]
SPECS = ["Cardiology","Neurology","Orthopedics","Pediatrics","Dermatology","Endocrinology",
         "Gastroenterology","Pulmonology","Nephrology","Oncology","Rheumatology","Urology",
         "Ophthalmology","ENT","Psychiatry","General Surgery","Internal Medicine","Family Medicine",
         "Emergency Medicine","Radiology","Anesthesiology","Pathology","Geriatrics","Hematology"]
CONDS = ["Hypertension","Type 2 Diabetes","Coronary Artery Disease","Asthma","COPD",
         "Chronic Kidney Disease","Heart Failure","Atrial Fibrillation","Stroke Recovery",
         "Osteoarthritis","Rheumatoid Arthritis","Depression","Anxiety Disorder","Hypothyroidism",
         "Anemia","Migraine","Epilepsy","Pneumonia","Bronchitis","Cancer Stage I","Cancer Stage II",
         "Chronic Pain Syndrome","Post-Surgical Recovery","Diabetes Complications","Dementia"]
REGIONS = ["New York","California","Texas","Florida","Illinois","Pennsylvania","Ohio","Georgia",
           "North Carolina","Michigan","New Jersey","Virginia","Washington","Arizona","Massachusetts",
           "Tennessee","Indiana","Missouri","Maryland","Colorado","Minnesota","Wisconsin",
           "South Carolina","Alabama","Louisiana","Kentucky","Oregon","Oklahoma","Connecticut","Utah"]
SERVICES = ["Inpatient","Outpatient","Emergency","Telehealth","Laboratory","Pharmacy","Surgery",
            "Diagnostics","Rehabilitation","Hospice"]
BLOOD = ["A+","A-","B+","B-","AB+","AB-","O+","O-"]
ALL_FIRST = FIRST_M + FIRST_F


def make_ids(prefix, n, width):
    return np.array([f"{prefix}{i+1:0{width}d}" for i in range(n)])


def main():
    log.info("=" * 60)
    log.info("  FAST Generator — 2.37 Crore Data Points")
    log.info("=" * 60)
    t0 = time.time()
    rng = np.random.default_rng(42)
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    # ── 1. Hospitals (500) ──
    log.info("Generating hospitals...")
    n_h = 500
    hosp_ids = make_ids("HOSP", n_h, 4)
    hospitals = pd.DataFrame({
        "id": hosp_ids,
        "name": [f"{rng.choice(['City','Regional','Memorial','Central','Metro'])} {REGIONS[i%len(REGIONS)]} Hospital" for i in range(n_h)],
        "type": rng.choice(["General","Teaching","Specialty","Trauma","Community"], size=n_h),
        "region": [REGIONS[i%len(REGIONS)] for i in range(n_h)],
        "bed_capacity": rng.integers(50, 1200, size=n_h),
        "icu_beds": rng.integers(5, 100, size=n_h),
        "established_year": rng.integers(1950, 2020, size=n_h),
        "emergency_services": rng.choice([True, False], p=[0.8, 0.2], size=n_h),
        "annual_budget_millions": np.round(rng.uniform(10, 500, size=n_h), 2),
        "rating": np.round(rng.uniform(3.5, 5.0, size=n_h), 1),
    })
    log.info(f"  ✅ Hospitals: {len(hospitals):,} in {time.time()-t0:.1f}s")

    # ── 2. Doctors (50,000) ──
    t1 = time.time()
    log.info("Generating doctors...")
    n_d = 50_000
    doc_ids = make_ids("DOC", n_d, 6)
    doctors = pd.DataFrame({
        "id": doc_ids,
        "doctor_id": doc_ids,
        "name": ["Dr. " + rng.choice(ALL_FIRST) + " " + rng.choice(LAST) for _ in range(n_d)],
        "specialization": rng.choice(SPECS, size=n_d),
        "experience_years": rng.integers(2, 40, size=n_d),
        "rating": np.round(rng.uniform(3.0, 5.0, size=n_d), 1),
        "hospital_id": rng.choice(hosp_ids, size=n_d),
        "region": rng.choice(REGIONS, size=n_d),
        "consultation_fee": rng.integers(50, 500, size=n_d),
        "availability": rng.choice(["Full-time","Part-time","On-call"], size=n_d),
        "patients_handled": rng.integers(100, 5000, size=n_d),
        "performance_score": np.round(rng.uniform(60, 100, size=n_d), 2),
    })
    log.info(f"  ✅ Doctors: {len(doctors):,} in {time.time()-t1:.1f}s")

    # ── 3. Patients (500,000) ──
    t1 = time.time()
    log.info("Generating patients...")
    n_p = 500_000
    pat_ids = make_ids("PAT", n_p, 7)
    genders = rng.choice(["Male","Female","Other"], size=n_p)
    first_names = np.where(genders == "Male",
                           rng.choice(FIRST_M, size=n_p),
                           rng.choice(FIRST_F, size=n_p))
    adm_offsets = rng.integers(1, 365, size=n_p)
    adm_dates = np.array([(now - timedelta(days=int(d))).strftime("%Y-%m-%d") for d in adm_offsets])

    patients = pd.DataFrame({
        "id": pat_ids,
        "name": [f"{first_names[i]} {rng.choice(LAST)}" for i in range(n_p)],
        "age": rng.integers(1, 100, size=n_p),
        "gender": genders,
        "blood_group": rng.choice(BLOOD, size=n_p),
        "region": rng.choice(REGIONS, size=n_p),
        "condition": rng.choice(CONDS, size=n_p),
        "status": rng.choice(["Active","Critical","Stable","Discharged"], p=[0.4,0.1,0.3,0.2], size=n_p),
        "admission_date": adm_dates,
        "doctor_id": rng.choice(doc_ids, size=n_p),
        "insurance_provider": rng.choice(["HealthShield","MediGuard","SecureLife","CarePlus"], size=n_p),
        "emergency_contact": [f"{rng.choice(LAST)} Family" for _ in range(n_p)],
        "medical_history": rng.choice(["None","Allergy","Previous Surgery","Chronic"], size=n_p),
        "is_critical": rng.choice([True, False], p=[0.15, 0.85], size=n_p),
    })
    log.info(f"  ✅ Patients: {len(patients):,} in {time.time()-t1:.1f}s")

    # ── 4. Appointments (1,500,000) ──
    t1 = time.time()
    log.info("Generating appointments...")
    n_a = 1_500_000
    apt_ids = make_ids("APT", n_a, 8)
    day_off = rng.integers(-30, 30, size=n_a)
    apt_dates = np.array([(now + timedelta(days=int(d))).strftime("%Y-%m-%d") for d in day_off])
    hrs = rng.integers(8, 18, size=n_a)
    mins = rng.choice(["00","15","30","45"], size=n_a)

    appointments = pd.DataFrame({
        "id": apt_ids,
        "patient_id": rng.choice(pat_ids, size=n_a),
        "doctor_id": rng.choice(doc_ids, size=n_a),
        "appointment_date": apt_dates,
        "appointment_time": [f"{hrs[i]:02d}:{mins[i]}" for i in range(n_a)],
        "status": rng.choice(["Completed","Scheduled","Cancelled","No-Show"], p=[0.6,0.2,0.1,0.1], size=n_a),
        "type": rng.choice(["Routine Checkup","Consultation","Emergency","Follow-up"], size=n_a),
        "duration": rng.choice([15,30,45,60], size=n_a),
        "is_virtual": rng.choice([True, False], p=[0.2, 0.8], size=n_a),
        "notes": "Standard observation",
    })
    log.info(f"  ✅ Appointments: {len(appointments):,} in {time.time()-t1:.1f}s")

    # ── 5. Vitals (2,000,000) ──
    t1 = time.time()
    log.info("Generating vitals...")
    n_v = 2_000_000
    vit_ids = make_ids("VIT", n_v, 8)
    temps = np.round(rng.uniform(36.0, 39.5, size=n_v), 1)
    hr = rng.integers(50, 140, size=n_v)
    bp_s = rng.integers(90, 160, size=n_v)
    bp_d = rng.integers(60, 100, size=n_v)
    spo2 = rng.integers(88, 100, size=n_v)
    is_abn = (temps > 38.0) | (hr > 100) | (hr < 60) | (bp_s > 140) | (spo2 < 94)

    vitals = pd.DataFrame({
        "id": vit_ids,
        "patient_id": rng.choice(pat_ids, size=n_v),
        "heart_rate": hr,
        "blood_pressure": [f"{bp_s[i]}/{bp_d[i]}" for i in range(n_v)],
        "temperature_c": temps,
        "oxygen_saturation": spo2,
        "respiratory_rate": rng.integers(12, 25, size=n_v),
        "is_abnormal": is_abn,
        "alert_flag": is_abn,
    })
    log.info(f"  ✅ Vitals: {len(vitals):,} in {time.time()-t1:.1f}s")

    # ── 6. Billing (1,500,000) ──
    t1 = time.time()
    log.info("Generating billing...")
    n_b = 1_500_000
    bill_ids = make_ids("BILL", n_b, 8)
    amounts = np.round(rng.uniform(100, 5000, size=n_b), 2)
    billing = pd.DataFrame({
        "id": bill_ids,
        "patient_id": rng.choice(pat_ids, size=n_b),
        "appointment_id": rng.choice(apt_ids, size=n_b),
        "service_type": rng.choice(SERVICES, size=n_b),
        "amount": amounts,
        "billing_date": [(now - timedelta(days=int(d))).strftime("%Y-%m-%d") for d in rng.integers(1, 60, size=n_b)],
        "payment_status": rng.choice(["Paid","Pending","Overdue"], p=[0.7,0.2,0.1], size=n_b),
        "payment_method": rng.choice(["Credit Card","Insurance","Cash","UPI"], size=n_b),
        "tax": np.round(amounts * 0.05, 2),
        "total_amount": np.round(amounts * 1.05, 2),
    })
    log.info(f"  ✅ Billing: {len(billing):,} in {time.time()-t1:.1f}s")

    # ── 7. Caregivers (5,000) ──
    log.info("Generating caregivers...")
    n_c = 5000
    caregivers = pd.DataFrame({
        "id": make_ids("CG", n_c, 4),
        "name": [f"{rng.choice(ALL_FIRST)} {rng.choice(LAST)}" for _ in range(n_c)],
        "role": rng.choice(["Nurse","Medical Assistant","Technician","Support Staff"], size=n_c),
        "assigned_ward": [f"Ward {rng.integers(1,50)}" for _ in range(n_c)],
        "shift": rng.choice(["Morning","Evening","Night"], size=n_c),
        "performance_rating": np.round(rng.uniform(3.5, 5.0, size=n_c), 1),
    })

    # ── 8. Analytics JSON files (small, for agent prompts) ──
    log.info("Generating analytics JSON files...")

    # Doctor Load Analytics
    doc_load_sample = doctors.head(20).to_dict("records")
    doctor_load = {
        "summary": {
            "total_doctors": int(len(doctors)),
            "average_patients_per_doctor": int(patients.shape[0] // doctors.shape[0]),
            "overloaded_count": int((doctors["patients_handled"] > 3000).sum()),
        },
        "distribution_top_primary_physicians": [
            {
                "doctor_name": r["name"],
                "patient_count": int(r["patients_handled"]),
                "status": "Overloaded" if r["patients_handled"] > 3000 else "Normal",
                "capacity": 200,
                "efficiency_percent": float(r["performance_score"]),
            }
            for r in doc_load_sample
        ],
        "regional_load_distribution": [
            {"region": reg, "active_doctors": int((doctors["region"] == reg).sum()),
             "avg_patients_per_doctor": int(patients[patients["region"] == reg].shape[0] // max(1, (doctors["region"] == reg).sum()))}
            for reg in REGIONS[:15]
        ],
    }

    # Patient Outcome Trends
    outcome_trends = {
        "kpis": {
            "recovery_rate_percent": 78.5,
            "stability_index_percent": 85.2,
            "readmission_rate_percent": 8.3,
        },
        "monthly_outcome_ledger": [
            {"month": f"2026-{m:02d}", "success": int(rng.integers(8000, 15000)),
             "ongoing": int(rng.integers(20000, 40000)), "failed": int(rng.integers(500, 2000))}
            for m in range(1, 13)
        ],
        "regional_outcomes": [
            {"region": reg, "active_cases": int((patients[patients["region"]==reg]["status"]=="Active").sum())}
            for reg in REGIONS[:15]
        ],
    }

    # Summary Metrics
    summary_metrics = {
        "total_patients": int(len(patients)),
        "active_patients": int((patients["status"] == "Active").sum()),
        "critical_patients": int((patients["status"] == "Critical").sum()),
        "total_doctors": int(len(doctors)),
        "total_hospitals": int(len(hospitals)),
        "total_revenue": float(billing["total_amount"].sum()),
        "top_region": str(patients["region"].value_counts().index[0]),
        "top_doctor": str(doctors.sort_values("patients_handled", ascending=False).iloc[0]["name"]),
        "most_used_service": str(billing["service_type"].value_counts().index[0]),
        "revenue_by_service_2026": [
            {"service_name": svc, "total_revenue": float(billing[billing["service_type"]==svc]["total_amount"].sum())}
            for svc in SERVICES
        ],
        "revenue_by_region_2026": [
            {"region": reg, "total_revenue": float(billing[billing["patient_id"].isin(
                patients[patients["region"]==reg]["id"])]["total_amount"].sum())}
            for reg in REGIONS[:10]
        ],
        "monthly_revenue_2026": [
            {"month": f"2026-{m:02d}", "total_revenue": float(rng.uniform(300000, 600000))}
            for m in range(1, 13)
        ],
        "annual_revenue": [
            {"year": y, "total_revenue": float(rng.uniform(3000000, 7000000)),
             "paid_revenue": float(rng.uniform(2500000, 6000000)),
             "pending_revenue": float(rng.uniform(200000, 800000))}
            for y in [2024, 2025, 2026]
        ],
    }

    # Billing Revenue Summary
    billing_rev_summary = {
        "revenue_by_service_month_2026_04": [
            {"service_name": svc, "category": "Healthcare",
             "total_revenue": float(billing[billing["service_type"]==svc]["total_amount"].sum() / 12),
             "billing_count": int(billing[billing["service_type"]==svc].shape[0] // 12)}
            for svc in SERVICES
        ],
        "pending_payment_segments": [
            {"segment": seg, "cases": int(rng.integers(1000, 5000)), "amount": float(rng.uniform(50000, 200000))}
            for seg in ["0-30 days", "31-60 days", "61-90 days", "90+ days"]
        ],
    }

    # Save small JSON files for agent
    def save_json(data, name):
        p = DATA_DIR / name
        with open(p, "w") as f:
            json.dump(data, f, indent=2, default=str)
        log.info(f"  Saved {name}")

    save_json(doctor_load, "doctor_load_analytics.json")
    save_json(outcome_trends, "patient_outcome_trends.json")
    save_json(summary_metrics, "summary_metrics.json")
    save_json(billing_rev_summary, "billing_revenue_summary.json")
    save_json(caregivers.to_dict("records"), "caregivers.json")
    save_json([{"id": f"REG{i+1}", "name": r} for i, r in enumerate(REGIONS)], "regions.json")
    save_json([{"id": f"SVC{i+1}", "name": s} for i, s in enumerate(SERVICES)], "services.json")

    # ── 9. Load ALL into DuckDB ──
    t1 = time.time()
    db_path = str(DATA_DIR / "voxa_system.duckdb")
    log.info(f"Writing to DuckDB: {db_path}")
    conn = duckdb.connect(db_path)

    tables = {
        "hospitals": hospitals,
        "doctors": doctors,
        "patients": patients,
        "appointments": appointments,
        "vitals": vitals,
        "billing": billing,
        "caregivers": caregivers,
    }

    total_points = 0
    for name, df in tables.items():
        conn.execute(f"DROP TABLE IF EXISTS {name}")
        conn.execute(f"CREATE TABLE {name} AS SELECT * FROM df")
        cnt = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        cols = len(df.columns)
        total_points += cnt * cols
        log.info(f"  ✅ {name}: {cnt:,} rows × {cols} cols = {cnt*cols:,} data points")

    conn.close()
    log.info(f"  DuckDB write done in {time.time()-t1:.1f}s")

    # ── 10. Write large JSON files (for backward compat with agent) ──
    t1 = time.time()
    log.info("Writing large JSON files...")
    for name, df in [("hospitals", hospitals), ("doctors", doctors),
                     ("patients", patients), ("appointments", appointments),
                     ("vitals", vitals), ("billing", billing)]:
        path = DATA_DIR / f"{name}.json"
        df.to_json(path, orient="records", indent=2, default_handler=str)
        sz = path.stat().st_size / (1024*1024)
        log.info(f"  {name}.json: {sz:.1f} MB")
    log.info(f"  JSON write done in {time.time()-t1:.1f}s")

    elapsed = time.time() - t0
    log.info(f"\n{'='*60}")
    log.info(f"  ✅ COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f} min)")
    log.info(f"  🎯 TOTAL DATA POINTS: {total_points:,} (~{total_points/10_000_000:.2f} crore)")
    log.info(f"{'='*60}")


if __name__ == "__main__":
    main()
