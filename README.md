# Patient Health Risk Assessment System

## Project Status

Milestone 1 – System Design Phase

This repository currently contains the project idea and system design artifacts including UML and ER diagrams. Backend and frontend implementation will begin in the next milestone.

---

## Project Vision

The Patient Health Risk Assessment System is planned as a full-stack healthcare application that will enable structured patient data management and predictive health risk evaluation using a modular machine learning component.

The system is being designed with strong backend engineering principles as the primary focus.

---

## Planned System Objectives

The final system is intended to:

- Manage patient records and clinical data
- Perform health risk prediction using a modular ML engine
- Generate structured health reports
- Provide medical recommendations
- Allow patients to view their assessment results
- Follow scalable backend architecture practices

---

## Planned Architecture

The system will follow a layered backend structure:
Client (React)
↓
Controller Layer
↓
Service Layer
↓
ML Risk Engine (Modular)
↓
Repository Layer
↓
PostgreSQL Database


This structure ensures separation of concerns, maintainability, and scalability.

---

## Planned Tech Stack

### Backend
- Node.js
- RESTful APIs
- MVC Architecture
- PostgreSQL
- Modular ML component
- Validation & Exception Handling Middleware

### Frontend
- React JS
- API Integration
- Structured UI Components

### Scalability Considerations (Future Implementation)
- Rate Limiting
- Caching
- Modular service design
- Clean API boundaries

---

## Machine Learning (Planned Integration)

The ML Risk Engine will:

- Accept structured clinical data
- Compute a health risk score
- Classify risk levels (Low / Medium / High)

Initially, the ML logic will be simulated or modularized.
Future updates may include integration of trained predictive models.

The ML module will be abstracted within the service layer to ensure loose coupling and replaceability.

---

## Database Design (Planned)

Core entities include:

- Users
- Patients
- Clinical Data
- Risk Assessments
- Health Reports

Schema design is defined in the ER diagram and will be implemented in PostgreSQL during development phase.

---

## Software Engineering Principles (Planned Implementation)

The backend will be developed following:

- Object-Oriented Programming
- Encapsulation
- Abstraction
- Service Layer Architecture
- Repository Pattern
- DTO-based data transfer
- Modular folder structure

---

## Current Repository Contents

- idea.md
- useCaseDiagram.md
- sequenceDiagram.md
- classDiagram.md
- ErDiagram.md

These documents define the functional and structural blueprint of the system.

---

## Upcoming Milestones

- Backend project setup
- Database schema implementation
- REST API development
- ML risk engine simulation
- Authentication and authorization
- Frontend integration
- Performance and scalability improvements

---

## Long-Term Goal

To evolve this system into a scalable healthcare risk assessment platform with real ML integration and production-level backend design.

---

## Author

Dev Kumar Singh  
SESD Project – Milestone 1




