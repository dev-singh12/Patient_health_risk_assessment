# Use Case Diagram

## System Name
Patient Risk Assessment System

---

## Actors

- Healthcare Staff
- Patient
- Medical Knowledge Source (External System)

---

## Use Cases

### Data Management
- Add Patient Information
- Upload Clinical Data

### Core Processing
- Predict Health Risk
- Generate Health Report
- Generate Recommendations
- Retrieve Medical Knowledge

### Patient Access
- View Risk Prediction
- View Health Report

---

## Relationships

Healthcare Staff interacts with:
- Add Patient Information
- Upload Clinical Data
- Predict Health Risk

Patient interacts with:
- View Risk Prediction
- View Health Report

Retrieve Medical Knowledge interacts with:
- Medical Knowledge Source

---

## Include Relationships

- Predict Health Risk includes Generate Health Report
- Generate Health Report includes Generate Recommendations
- Generate Recommendations includes Retrieve Medical Knowledge

---

## Design Justification

The diagram models external system interactions only.
Internal ML preprocessing and algorithm logic are not included as Use Case Diagrams focus on functional requirements.


Image- <img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/4d54624a-468e-489c-9cff-2ac5d70fb462" />

