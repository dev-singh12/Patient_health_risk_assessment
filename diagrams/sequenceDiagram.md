# Sequence Diagram

## Main Flow: Health Risk Assessment

Actors:
- Healthcare Staff
- System
- Risk Engine
- Knowledge Service
- Database

---

## Sequence Steps

1. Healthcare Staff submits patient data.
2. System validates input.
3. System stores patient data in Database.
4. Healthcare Staff triggers Predict Health Risk.
5. System calls Risk Engine.
6. Risk Engine calculates risk score.
7. System generates Health Report.
8. System calls Knowledge Service for recommendations.
9. Knowledge Service retrieves data from External Medical Knowledge Source.
10. System attaches recommendations to report.
11. System stores report in Database.
12. Patient views Risk Prediction.
13. Patient views Health Report.

---

## Design Notes

- Separation between Controller and Service layer.
- Risk Engine is modular.
- External Knowledge Source accessed through service abstraction.


Image- <img width="4191" height="3799" alt="image" src="https://github.com/user-attachments/assets/3ecc5d0a-a2c9-4830-ac8f-e034826a02a2" />

