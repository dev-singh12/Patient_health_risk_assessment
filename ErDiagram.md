# ER Diagram

## Entities

### USERS
- user_id (PK)
- name
- email (unique)
- password
- role
- created_at

---

### PATIENTS
- patient_id (PK)
- user_id (FK → USERS.user_id)
- age
- medical_history

---

### CLINICAL_DATA
- clinical_id (PK)
- patient_id (FK → PATIENTS.patient_id)
- metrics
- created_at

---

### RISK_ASSESSMENT
- assessment_id (PK)
- patient_id (FK → PATIENTS.patient_id)
- risk_score
- status
- created_at

---

### HEALTH_REPORT
- report_id (PK)
- assessment_id (FK → RISK_ASSESSMENT.assessment_id)
- summary
- recommendations
- created_at

---

## Relationships

- USERS 1 — 1 PATIENTS
- PATIENTS 1 — many CLINICAL_DATA
- PATIENTS 1 — many RISK_ASSESSMENT
- RISK_ASSESSMENT 1 — 1 HEALTH_REPORT
