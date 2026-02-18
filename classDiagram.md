# Class Diagram

## Major Classes

### User
Attributes:
- id
- name
- email
- password
- role
- createdAt

---

### Patient
Attributes:
- patientId
- userId
- age
- medicalHistory

---

### ClinicalData
Attributes:
- id
- patientId
- metrics
- createdAt

---

### RiskAssessment
Attributes:
- id
- patientId
- riskScore
- status
- createdAt

Methods:
- calculateRisk()

---

### HealthReport
Attributes:
- id
- assessmentId
- summary
- recommendations
- createdAt

---

### RecommendationService
Methods:
- generateRecommendations()

---

## Relationships

- User 1 --- 1 Patient
- Patient 1 --- many ClinicalData
- Patient 1 --- many RiskAssessment
- RiskAssessment 1 --- 1 HealthReport
