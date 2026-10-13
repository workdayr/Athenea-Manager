# ATHENEA MANAGER
## SOFTWARE ARCHITECTURE AND DESIGN
**Software Projects Management**

**TEAM**
*   Arellano Hernández Alejandro
*   Rodriguez Rodarte Steve Julian
*   Aguilar Reyes Armando Guadalupe
*   De la Cruz Gurrola Julio Cesar

**Date:** September 26th, 2026
**ZELLARA SOFTWARE SOLUTIONS**
**UNIPOLI BIS INGENIERÍA EN SOFTWARE**

---

## Index
1. Introduction to Design
    1.1. Purpose of the document and problem to be solved
    1.2. Objectives and scope of the design
    1.3. Relationship to the approved requirements
2. System Architecture
    2.1. Architectural Style
    2.2. High-Level Architecture Diagram
    2.3. System Components and Modules
3. Technology Stack
4. Data Design
    4.1. Data Dictionary
    4.2. Entity-Relationship Diagram (ERD)
5. API and Communications Design
    5.1. API Design
    5.2. Justification on the decision
        5.2.1. Why GraphQL for domain operations
        5.2.2. Why REST for uploads, auth, and infrastructure
        5.2.3. Why SSE for the AI assistant
    5.3. Main endpoints
        5.3.1. REST API
        5.3.2. GraphQL API
        5.3.3. SSE - AI Assistant Streaming
6. Integrations and External Systems
    6.1. Required third-party services
    6.2. Communication methods and failure scenarios
7. Artificial Intelligence / Machine Learning Architecture
    7.1. Data flow and preprocessing
    7.2. Models, validation, and integration with the core system
8. Interface Design and User Experience (UI/UX)
    8.1. User Flows and Navigation
    8.2. Mockups / Prototypes of Main Screens
9. System Design and UML Diagrams
    9.1. Use Case Diagram
    9.2. Component Diagram
    9.3. Deployment Diagram
    9.4. Sequence Diagrams
10. Security and Privacy
    10.1. Authentication and Authorization Mechanisms
    10.2. Data protection and vulnerability prevention
    10.3. Information Retention and Privacy Policies
11. Error and Exception Handling
    11.1. Critical Failure Scenarios
12. Non-Functional Requirements in Design
    12.1. Matrix of NFRs vs. Design Decisions
13. Technical Decisions and Justification (ADR)
    13.1. Record of at least 5 critical architectural decisions
14. Technical Risks and Open Questions
    14.1. Matrix of unresolved technical risks prior to implementation
15. Traceability Matrix
    15.1. Final mapping

---

## 1. Introduction to Design

### 1.1. Purpose of the document and problem to be solved.
The overall purpose of the Software Solution Design Document is to establish a detailed technical and structural foundation that enables Zellara's development team to understand the proposed solution and begin its implementation with as little ambiguity as possible. This document serves as the definitive bridge between the requirements specification and code writing.

### 1.2. Objectives and scope of the design.
This document has the goal of fulfilling the following core objectives:
*   **Technical Translation:** Transforms user needs, business rules, and non-functional requirements into tangible software components, database structures, and user interfaces.
*   **Risk Prevention:** Requires the team to identify failure scenarios, security issues, and technical risks before they become costly errors during the development phase.
*   **Traceability and Justification:** Ensures that every technological and architectural decision is directly supported by a previously approved requirement, preventing the introduction of unnecessary features based solely on personal preference.
*   **Team Alignment:** Provides a single source of technical truth so that everyone involved shares the same vision of how the system, its integrations, and its data flow will be built.

This design document establishes the technical foundation for the Athenea Manager platform, encompassing:
*   **In-Scope:** Definition of the system architecture, structural and behavioral diagrams (UML), database design (ERD and data dictionary), user interface prototypes (mockups), API endpoint definitions, and security protocols.
*   **Out-of-Scope:** This document is strictly for technical planning and does not include source code implementation, user manuals, physical server configuration, or the final deployment of the functional software.

### 1.3. Relationship to the approved requirements.
The primary basis for the proper development of this document will be the previously created document that describes in detail and comprehensively covers the requirements to be addressed during the creation of the research platform; in this way, we will be able to use these requirements as a basis for making decisions that best help us meet the previously specified needs. This document is titled "Software Requirements Specifications Corrected", which is the version that has been reviewed, corrected, and approved by our team's QA department. Within this document, you will find specifications for both functional and non-functional requirements, as well as additional elements that will help us track compliance with these requirements, such as business rules, use cases, and the MoSCoW classification.

---

## 2. System Architecture

### 2.1. Architectural Style
The architecture combines two decisions operating at different levels: how the frontend and backend relate to each other, and how the backend is organized internally.

**Client-Server Relationship**
The system follows a client-server architecture: a frontend client and a backend application are two independently deployable units that communicate exclusively through a defined API. The client handles presentation and user interaction; the backend handles business logic, data access, and integration with external services. Neither depends on the other's internal structure, they only depend on the contract (the API) between them.
This separation is appropriate because it allows the client and the backend to evolve, be tested, and be deployed independently, and because different stakeholder roles (researchers, coordinators, evaluators, administrators) can share the same backend while receiving different views and permissions through the same API.

**Backend Internal Organization**
Within the backend, the system follows a modular monolith pattern: a single deployable application, internally divided into isolated domain modules (Authentication and Access Control, Project Lifecycle Management, Milestones and Monitoring, Documents and Evidence, Evaluation, Reporting, Notifications, and the AI Assistant). Each module owns its own business logic and data access, and exposes a clear interface to the other modules, rather than the backend being one undifferentiated block of code.
Each module additionally follows a layered structure internally: an interface layer (handling incoming requests), a business logic layer (domain rules), and a data access layer (persistence), keeping these concerns separated within every module.
Asynchronous work (such as document ingestion, since source documents may be large or inconsistently formatted) runs through background job processing rather than blocking user requests.

**Why this style fits Athenea Manager:**

| Criterion | How the architecture answers it |
| :--- | :--- |
| **Limited academic period and budget** | A single backend deployable unit avoids the operational cost of coordinating and deploying multiple independent services. |
| **Role-based functionality** | Access control is enforced once, centrally, in the backend, and reused by every module, including the AI assistant's retrieval step, which is the core mechanism for protecting confidential information. |
| **Strongly relational domain** | Projects, milestones, evidence, collaborators, and evaluations are tightly interrelated and benefit from transactional consistency within a single data layer. |
| **Independent frontend evolution** | The client-server separation lets the frontend's role-based dashboards evolve or be redesigned without requiring backend changes, as long as the API contract holds. |
| **Future expansion** | Clear module boundaries in the backend allow new research areas or institutional procedures to be added as new modules without restructuring the system. A heavily loaded module could later be extracted into an independent service if needed. |

### 2.2. High-Level Architecture Diagram.
Mermaid is a platform that allows users to generate visual charts or diagrams created entirely from plain text using a JavaScript-based tool. Instead of manually dragging and dropping shapes on a canvas, a user can write simple, Markdown-inspired code that a renderer automatically converts into a polished graphic. From now on, and for purposes of this document, mermaid will be highly used whenever diagrams are required.

Link to view the diagram in detail (Mermaid):
*[High-level Architecture Diagram Placeholder]*

### 2.3. System Components and Modules

| Component | Responsibility | Related Requirements | Dependencies |
| :--- | :--- | :--- | :--- |
| **Authentication and Access Control** | Authenticate institutional users and enforce role-based access across the platform | RF-001, RF-010, RF-015, BR-005 | User database |
| **Project Lifecycle Management** | Manage project registration, approval state machine, and proposal version history | RF-003, RF-002, RF-004, BR-001, BR-002, BR-003 | Authentication module, Documents module, Database |
| **Documents and Evidence** | Handle document upload, storage, and visibility configuration | RF-005, RF-016, RNF-005, BR-006, BR-007, BR-012 | Authentication module, File storage |
| **Milestones and Monitoring** | Track activities and milestones, flag delayed progress, surface cross-project status | RF-006, BR-008 | Project Lifecycle module, Job scheduler |
| **Evaluation** | Support committee review, conflict-of-interest checks, and formal decisions | RF-003, RF-019, BR-004, BR-011 | Project Lifecycle module, Documents module |
| **Reporting** | Generate dashboards and statistical reports | RF-008, RF-013 | Project Lifecycle module, Milestones module, Evaluation module |
| **Notifications** | Deliver in-app and email alerts for deadlines and status changes | RF-014, BR-008 | Milestones module, Email service |
| **Audit and Compliance** | Record an immutable log of all significant actions and enforce encryption of sensitive data | RF-017, RNF-001, RNF-010 | Authentication module, Database |
| **AI Assistant (RAG)** | Answer natural-language questions using only authorized document fragments, with source citations | RF-009, AIR-001-AIR-005, RNF-008 | Authentication module, Documents module, External LLM service |
| **Background Job Processing** | Execute asynchronous work: document ingestion, delayed-activity flagging, report rendering, archival | RF-006, RF-019, RF-020, BR-013 | Project Lifecycle module |

---

## 3. Technology Stack

| Layer | Technology | Purpose | Justification |
| :--- | :--- | :--- | :--- |
| **Frontend** | React, NextJS | Handle presentation, user interactions and render role based dashboard. | Allows the client interface to evolve independently from the backend while maintaining the API contract. |
| **Backend** | NestJS | Centralize business logic, data access and API exposure across isolated domain modules. | Fits the modular monolith pattern perfectly, keeping domains decoupled but deployable as a single unit. |
| **Authentication** | BetterAuth | Manage user identity, role-based access and token issuance. | Provides reliable support for stateful, redirect-driven HTTP exchanges necessary for OAuth 2.0 Institutional Logins. |
| **Database** | PostgreSQL, Prisma ORM, pgvector | Persist system data and manage complex relationships securely. | The project domain is strongly relational, requiring the transactional consistency that a SQL database and a robust ORM provide, while pgvector allows data to be interpreted by the external LLM API. |
| **Testing** | Jest, LangWatch, K6 | Validate application logic, monitor AI behavior and evaluate system performance under load. | Jest natively integrates with NestJS for unit and integration test, LangWatch is strictly necessary to evaluate LLM prompt accuracy, track AI behavior and monitor generation costs, K6 is required to simulate concurrent users and validate that the system meets the performance constraints. |
| **Deployment** | Hostinger | Host the client frontend, backend API and database infrastructure. | A single backend deployable unit avoids the operational overhead of microservices, fitting the limited academic period and budget constraints perfectly. |
| **LLM API** | Gemini 1.5 Flash | tbd | tbd |

---

## 4. Data Design

### 4.1. Data Dictionary.

| Entity | Attribute | Data Type | Required? | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Users | User_id | INT | Yes | A unique numerical identifier for each user registered in the system. | PK (Primary Key) |
| Users | Name | VARCHAR | Yes | The user's full name for identification on the platform. | Maximum 150 characters. |
| Users | mail | VARCHAR | Yes | The email address used for registration and OAuth authentication. | Unique. Must be an institutional email address or an authorized academic/corporate domain |
| Users | password | VARCHAR | Yes | The user's password, stored securely after being cryptographically processed. | Original length between 8 and 64 characters. Encrypted using bcrypt with a cost factor of 12 |
| Users | role | ENUM | Yes | The user's access level and permissions within the system. | Allowed values: Principal Investigator, Student, Coordinator, Committee, Administrator |
| Users | failed_attempts | INT | | Counter for failed login attempts to prevent brute-force attacks. | Default 0. Upon reaching 5, the account is temporarily locked for 15 minutes |
| Announcement | call_id | INT | Yes | Unique identifier for the call for proposals published by administrators. | PK |
| Announcement | title | VARCHAR | Yes | Official title of the call for research projects. | Maximum 200 characters. |
| Announcement | date_published | TIMESTAMP | | Date on which the call becomes visible to researchers. | Cannot be later than the deadline. |
| Announcement | deadline | TIMESTAMP | Yes | Exact date and time of the call's closing. | Automatic lock via Row-Level Locking |
| Announcement | description | TEXT | Yes | Detailed explanation of the terms, requirements, and objectives of the call. | No strict character limit. |
| Announcement | application_cap | INT | Yes | Optional maximum limit on the number of applications allowed before automatic closure. | Greater than 0 if specified |
| Project | project_id | INT | Yes | Unique identifier for the research project. | PK |
| Project | title | VARCHAR | Yes | Official name of the research project. | Maximum 300 characters |
| Project | objectives | TEXT | Yes | Description of the research objectives | Maximum 2,000 characters |
| Project | start_date | TIMESTAMP | Yes | Scheduled start date for project activities | Must be less than end_date |
| Project | end_date | TIMESTAMP | Yes | Scheduled completion date for the project. | Must be greater than start_date |
| Project | status | ENUM | Yes | Current status of the project within its lifecycle and approval workflow. | Values: Proposed, Under Review, Approved, Active, Completed, Closed, Rejected, Suspended. Default: Proposed |
| Project | budget_enabled | BOOLEAN | Yes | Flag indicating whether the principal investigator has enabled the expense management module. | Default: False |
| Project | is_confidential | BOOLEAN | Yes | Flag indicating whether the project contains sensitive information that should not be made public. | If True, it is excluded from public search results |
| Project_User | projectuser_id | INT | Yes | Unique identifies for the project users | PK |
| Project_User | project_id | INT | Yes | Reference to the specific research project. | FK referencing Project |
| Project_User | user_id | INT | Yes | Reference to the user assigned to the project team. | FK referencing Users. |
| Project_User | project_role | ENUM | Yes | Specific role that the user plays within this project. | Values: Principal Investigator, Co-Investigator, Assistant. Restricted by nepotism rules |
| Document | document_id | INT | Yes | Unique identifier for each attachment uploaded to the platform. | PK |
| Document | project_id | INT | Yes | Reference to the project to which the evidence or document belongs. | FK referencing Project. |
| Document | doc_type | ENUM | Yes | Categorization of the document according to minimum requirements or evidence. | Values: hypothesis, abstract, methodology, rationale, results, ethics_approval |
| Document | visibility | ENUM | Yes | Document access restriction level for users outside the team. | Values: Team-only, Shared with administration. Verify that documents requiring mandatory review are not set to "Team-only" |
| Document | file_url | VARCHAR | Yes | Signed temporary path or URL where the file is hosted in the storage system. | The underlying file must be no larger than 25 MB (RNF-005). Maximum of 5 retained revisions |
| Document | version | INT | Yes | Numeric version control to maintain the history of modified proposals. | Maximum 5 versions retained |
| Milestone | milestone_id | INT | Yes | Unique identifier for the activity or deliverable defined in the project. | PK |
| Milestone | project_id | INT | Yes | Reference to the project in which the activity was planned. | FK referencing Project. |
| Milestone | name | VARCHAR | Yes | Short, descriptive title of the activity to be performed. | Maximum 150 characters |
| Milestone | assignee_id | INT | Yes | Reference to the user (researcher or student) responsible for completing the task. | FK referencing Users |
| Milestone | due_date | DATE | Yes | Deadline set for completing and reporting on the activity. | Determines the automatic delay flag |
| Milestone | status | ENUM | Yes | Current progress of the activity. | Values: Pending, Completed, Delayed. Automatically updates to "Delayed" on the 7th day of delay |
| Product | product_id | INT | Yes | Unique identifier of the research result or derivative product. | PK |
| Product | project_id | INT | Yes | Reference to the project that generated the research output. | FK referencing Project. |
| Product | product_type | INT | Yes | Official category of the generated output (e.g., article, thesis, patent). | Exact values: journal article, conference presentation, software, patent, thesis |
| Product | url_doi | VARCHAR | Yes | Link to the repository, journal, or DOI where the published product can be accessed. | Strict validation using regular expressions (Regex) for URLs and DOIs |
| Expense | expense_id | INT | Yes | Unique identifier of the reported financial transaction. | PK |
| Expense | project_id | INT | Yes | Reference to the project from which the expense is being deducted. | FK referencing Project. |
| Expense | amount | DECIMAL | Yes | Exact monetary amount spent, in Mexican pesos (MXN). | DECIMAL(9,2). Numeric only, positive, with a maximum limit of 9,999,999.99 |
| Expense | expense_description | VARCHAR | Yes | Description or justification of the purchase/expense incurred. | Maximum 255 characters. Required to provide context for the reported financial amount. |
| Audit_Log | log_id | INT | Yes | Unique identifier of the audit event recorded in the system. | PK |
| Audit_Log | actor_id | INT | Yes | Reference to the user who performed the audited action. | FK referencing Users |
| Audit_Log | action | VARCHAR | Yes | Technical description of the action performed (e.g., file change, state transition). | Standardized values (e.g., FILE_UPLOAD, STATUS_CHANGE, ROLE_CHANGE) |
| Audit_Log | target_id | VARCHAR | Yes | Identifier of the resource affected by the action (e.g., a project_id or document_id). | Enables traceability at the resource level |
| Audit_Log | source_ip | VARCHAR | Yes | Network IP address from which the request for the action originated. | IPv4/IPv6 format validation |
| Audit_Log | timestamp | TIMESTAMP | Yes | Exact timestamp of when the server processed and logged the action. | Strictly stored in UTC format. Immutable. |

### 4.2. Entity-Relationship Diagram (ERD).
Entity-Relationship Diagram made in Mermaid *(Diagram omitted for brevity)*

---

## 5. API and Communications Design

### 5.1 API Design
The backend exposes three distinct communication mechanisms, matching the hybrid API style defined in Section 5.3: REST for stateful/non-domain operations (authentication flows, file uploads, health checks), GraphQL for domain operations (projects, milestones, documents metadata, evaluation, reporting, audit), and SSE (Server-Sent Events) for streaming the AI assistant's responses. Each is documented separately below.

### 5.2 Justification on the decision
Athenea Manager does not adopt a single API paradigm across the board because each of its three communication needs has fundamentally different requirements, and forcing all of them into one style would either add unnecessary complexity or lose real technical benefits.

#### 5.2.1 Why GraphQL for domain operations
The platform's core defining trait is that different roles need different shapes of the same data: a researcher viewing a project needs full detail (documents, milestones, team, budget), while a coordinator viewing the same project across a dashboard needs only summary fields (status, delay flag, PI name). With a REST API, this typically forces a choice between:
*   over-fetching (every role gets the same full payload, wasting bandwidth and exposing more fields than a role needs), or
*   proliferating role-specific endpoints (`/projects/summary`, `/projects/full`, `/projects/coordinator-view`, etc.), which becomes hard to maintain as the number of roles and views grows.

GraphQL solves this directly: each client query specifies exactly the fields it needs, and the same `project(id)` query serves a researcher's detailed view and a coordinator's summary view without duplicating endpoints. This also pairs naturally with the RBAC filtering required by RF-001, a single resolver layer can strip unauthorized fields per role without needing parallel REST routes per role.

#### 5.2.2 Why REST for uploads, auth, and infrastructure
GraphQL is deliberately not used for three categories of operation, because it is a poor technical fit for them:
*   **File uploads (RF-016):** GraphQL's JSON-based transport is not designed for binary/multipart payloads. REST's native `multipart/form-data` support is the standard, well-tested mechanism for this, and is what most GraphQL implementations themselves fall back to internally.
*   **Authentication flows (RF-010, RF-015):** Login, token refresh, and especially OAuth 2.0 callbacks are inherently stateful, redirect-driven HTTP exchanges. OAuth's redirect-based handshake does not map onto a query/mutation model, and standardizing on REST here also makes the endpoints easy to test and secure independently of the application's domain logic.
*   **Infrastructure endpoints (/health, RNF-003):** Uptime monitoring tools expect plain REST/HTTP health checks, not a GraphQL query, using REST here keeps monitoring integration simple and tool-agnostic.

#### 5.2.3 Why SSE for the AI assistant
The AI assistant's response is not a single, immediately-available value, it is generated incrementally by an external LLM API (RF-009). Neither REST nor GraphQL query/mutation semantics fit a token-by-token generation process well:
*   A REST/GraphQL request-response cycle would force the user to wait for the entire answer before seeing anything, which feels slow and defeats the purpose of a conversational assistant.
*   Full GraphQL Subscriptions (typically WebSocket-based) would work, but they introduce a persistent bidirectional connection and additional infrastructure (a pub/sub layer) for a need that is strictly one-directional: server-to-client streaming of tokens, with no client-to-server messages needed mid-stream.

SSE is the minimal mechanism that matches this need exactly: a simple, one-directional HTTP stream, natively supported by browsers without extra libraries, that lets the UI render the assistant's answer progressively, which also makes it easier to enforce and surface the "insufficient information" refusal (AIR-001) and citations (AIR-003) as discrete, ordered events in the stream, rather than parsing them out of one large final payload.

### 5.3 Main endpoints

#### 5.3.1 REST API

| Method | Endpoint | Purpose | Request | Response |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/register` | Register a new user | JSON (email, password, name) | Created user (no password) |
| POST | `/auth/login` | Authenticate and issue tokens | JSON (email, password) | Access + refresh tokens |
| POST | `/auth/refresh` | Renew an expired access token | JSON (refresh token) | New access token |
| POST | `/auth/logout` | Invalidate the current session | Bearer token | Confirmation |
| GET | `/auth/oauth/callback` | Complete OAuth 2.0 institutional login | Query parameters (code, state) | Redirect + tokens |
| POST | `/auth/password-reset/request` | Request a password reset token | JSON (email) | Confirmation (generic) |
| POST | `/auth/password-reset/confirm` | Set a new password using a reset token | JSON (token, new password) | Confirmation |
| POST | `/projects/:id/documents` | Upload a document/evidence file to a project | Multipart form-data (file, visibility) | Created document metadata |
| GET | `/documents/:id/download` | Retrieve a time-limited signed URL for a file | Bearer token | Signed URL (redirect) |
| GET | `/health` | Infrastructure liveness/readiness check | None | Service status |

**Full Development Per Endpoint**

**POST /auth/register**
*   **Purpose:** Registers a new institutional user account (RF-010).
*   **Authentication:** None (public endpoint).
*   **Request body (JSON):**
    *   `email` (string, required): Must match authorized domain (BR-005)
    *   `password` (string, required): 8-64 characters (RF-010)
    *   `fullName` (string, required)
*   **Response body:** `{ id, email, fullName, createdAt }` - password never returned.
*   **Status codes:** 201 Created / 400 Bad Request (validation failure) / 409 Conflict (email already registered) / 422 Unprocessable Entity (domain not authorized, BR-005).

**POST /auth/login**
*   **Purpose:** Authenticates a user and issues an access/refresh token pair (RF-010).
*   **Authentication:** None (public endpoint).
*   **Request body:** `{ email, password }`.
*   **Response body:** `{ accessToken, refreshToken, expiresIn, role }`.
*   **Status codes:** 200 OK / 401 Unauthorized (invalid credentials) / 423 Locked (5 failed attempts -> 15-minute lockout, RF-010).
*   **Error responses:** Generic "invalid credentials" message on failure does not reveal whether the email exists, to avoid user enumeration.

*(Other REST endpoints detailed in similar structure in original text)*

#### 5.3.2 GraphQL API

| Type | Operation | Purpose |
| :--- | :--- | :--- |
| Mutation | `registerProject` | Register a new research project |
| Mutation | `submitProjectDecision` | Committee records approve/reject/modification decision |
| Mutation | `uploadRevisedProposal` | Attach a new proposal version after a modification request |
| Mutation | `setDocumentVisibility` | Change a document's visibility |
| Mutation | `createMilestone` | Define a project activity/milestone |
| Mutation | `updateMilestoneProgress` | Update progress on an assigned milestone |
| Mutation | `registerResearchOutput` | Link a publication/patent/thesis to a project |
| Query | `project(id)` | Retrieve full detail of a single project |
| Query | `myProjects` | List projects for the authenticated researcher |
| Query | `coordinatorDashboard` | Cross-project status view for coordinators |
| Query | `statisticalReport(filters)` | Aggregated metrics (counts, budget, productivity) |
| Query | `auditLog(filters)` | Query the immutable action log |

**Full Development Per Operation**

**Mutation registerProject**
*   **Purpose:** Registers a new project in Proposed status (RF-002, BR-001, BR-002).
*   **Authentication/Role:** Main Researcher (must be a Tenured Researcher per BR-001).
*   **Input parameters:**
    *   `title` (string, required): ≤300 characters
    *   `objectives` (string, required): ≤2000 characters
    *   `researchers` ([UserID], required): Must include exactly one PI
    *   `startDate`, `endDate` (Date, required): endDate > startDate
    *   `requiredDocuments` ([Upload], required): Exactly 5 PDFs
*   **Response type:** `Project (id, title, status: PROPOSED, createdAt)`.
*   **Status/error codes:** GraphQL errors mapped to codes `VALIDATION_ERROR` (field limits/format), `PI_LIMIT_EXCEEDED` (BR-002, no exemption on file), `FORBIDDEN` (requester is not a Tenured Researcher, BR-001).

*(Other GraphQL operations detailed in similar structure in original text)*

#### 5.3.3 SSE - AI Assistant Streaming

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/ai/query` | Submits a question and opens an SSE stream for the response |

**Full development**
*   **Purpose:** Accepts a natural-language question, applies permission-filtered retrieval (AIR-004), and streams a grounded, cited response (RF-009, AIR-001, AIR-003).
*   **Authentication:** Bearer token (required); role and project permissions determine which document fragments the retriever is allowed to return.
*   **Request body (JSON):** `{ question: string, projectContext?: UUID }`.
*   **Response:** `text/event-stream`. Sequence of events:
    *   `token`: Incremental chunk of the generated answer (`{ text }`)
    *   `citation`: Source reference (one or more, AIR-003) (`{ documentTitle, documentId, section }`)
    *   `done`: Stream complete (`{ hasSufficientContext: boolean }`)
    *   `error`: Retrieval or generation failure (`{ code, message }`)

---

## 6. Integrations and External Systems

### 6.1. Required third-party services
To fulfill the functional and non-functional requirements of Athenea Manager, the system relies on the following external services:
*   **External LLM API:** Required to power the RAG-based AI assistant for generating natural language responses.
*   **Institutional Identity Providers (OAuth 2.0):** Required to handle social login and identity verification for university staff and authorized external domains.
*   **Institutional Key Management Service (KMS):** Required to securely manage the cryptographic keys used for encrypting sensitive personal data.
*   **Email Delivery Service (SMTP/API):** Required for dispatching transactional notifications, team invitations, and automated milestone alerts.
*   **Antivirus / Malware Scanning Service:** Required to automatically scan all uploaded files before they are saved to persistent storage, preventing the ingestion of malicious payloads.

### 6.2. Communication methods and failure scenarios.
*(Detailed breakdowns of each external service exist including external LLM API, Identity Providers, KMS, Email Service, and Antivirus)*

---

## 7. Artificial Intelligence / Machine Learning Architecture

### 7.1. Data flow and preprocessing.
*   **Data sources:** Authorized institutional procedures, internal regulations, and official documentation previously uploaded to research projects.
*   **Input data:** The natural language query submitted by the user and the authorized document fragments retrieved by the system to serve as context.
*   **Relevant variables/features:** The exact text of the query, the vector embeddings of the documents stored in pgvector, the user's role identifiers for Role-Based Access Control (RBAC), and the citation metadata (document title and section).
*   **Data preprocessing:** Project files and institutional texts are chunked and converted into vector embeddings for structured storage. When processing a query, the retrieval engine applies RBAC filters so that the vector search only scans fragments the user is explicitly authorized to view. Additionally, text input sanitization is applied to mitigate prompt injection attempts.

### 7.2. Models, validation, and integration with the core system
*   **Model:** Gemini 1.5 Flash, consumed via its external API. This cloud-based architecture was selected because the institution lacks dedicated GPU servers to host a local model, and its free tier perfectly fits the project's limited academic budget constraints.
*   **Training process:** The system utilizes a Retrieval-Augmented Generation (RAG) architecture, meaning the external foundational model does not require fine-tuning or retraining by the team.
*   **Model update/retraining strategy:** The system's knowledge base is updated continuously and dynamically by automatically generating and storing new vector embeddings whenever new projects, milestones, or supporting documents are uploaded to the platform.
*   **Prediction process (Generation):** The Gemini 1.5 Flash API receives the sanitized prompt along with the filtered document fragments. Through instructions in the system prompt, it is forced to generate a natural language response strictly grounded in the provided context, without fabricating or hallucinating external information.
*   **Validation:** Validation occurs in two critical stages. First, if the vector search does not find fragments exceeding the required similarity threshold, the AI generation is immediately aborted, and the system returns a predefined refusal message ("Information not found"). Second, the backend validates via regular expressions that the output generated by Gemini contains valid citation identifiers before allowing it to be transmitted to the interface.
*   **Output:** A natural language response that includes explicit, clickable citations for every claim, exactly referencing the source document's title and section.
*   **Integration with the application:** The assistant acts strictly as a consultative and isolated component. It connects to the transactional and vector databases using a database user with restricted privileges (GRANT SELECT ONLY) to algorithmically guarantee that the AI cannot alter or approve official data. The final response is delivered to the frontend progressively using Server-Sent Events (SSE) through the `POST /ai/query` endpoint.
*   **Performance metrics:** Operational performance is evaluated by monitoring the Gemini API rate limits, algorithmically verifying that 100% of successful responses comply with the citation validation constraint, and measuring token generation latency during the SSE streaming flow.

---

## 8. Interface Design and User Experience (UI/UX)

### 8.1. User Flows and Navigation.

| # | User Flow | Main Actor | Screens Used |
| :--- | :--- | :--- | :--- |
| 1 | Authentication and Role-Based Access | Everyone | Login -> Dashboard |
| 2 | Research Project Registration | Principal Investigator | Login -> Project Registration -> Dashboard |
| 3 | AI-Assisted Project Management/Inquiry | Researcher / Student / Coordinator / Committee / Admin | Login -> Dashboard -> AI Assistant |
| 4 | Project Documents and Visibility Management | Principal Investigator | Login -> Dashboard -> Detail View and Documents |
| 5 | Proposal Review and Revision | Committee / PI | Login -> Dashboard -> Detail View and Documents |
| 6 | Milestone and Student Progress | PI / Student / Coordinator | Login -> Dashboard -> Detail View and Documents -> Dashboard |
| 7 | Dashboard and Reports Monitoring | Coordinator / Administrator | Login -> Coordinator Dashboard / Reports |

### 8.2. Mockups / Prototypes of Main Screens.

*(Note: Visual mockups provided in the document demonstrate standard application wireframes, described below)*

1.  **Login:** Authenticate institutional users and authorized personnel using standard credentials or Single Sign-On (SSO). Includes Email/password form, OAuth 2.0 integration buttons, account recovery link.
2.  **Coordinator Dashboard / Reports:** Provide a consolidated view of cross-project metrics and identify projects that are falling behind schedule. Includes Sidebar navigation, KPI cards, filterable data table with server-side pagination.
3.  **Project Registration (Data Entry):** Structurally capture the base information and required documentation to initiate a research protocol. Includes Text fields with length validation, date pickers, file upload dropzone for PDFs.
4.  **Detail View and Documents:** Manage the project lifecycle, access version history, and configure information privacy. Includes Header with current status, tabbed navigation, file list, visibility controls.
5.  **AI Assistant:** Provide users with natural language answers to procedural queries without risking the exposure of confidential data. Includes Conversational chat interface, text input field, persistent non-authoritative disclaimer block, links to bibliographic citations.

---

## 9. System Design and UML Diagrams

*(Note: Section references external Mermaid diagrams for Use Case, Component, Deployment, and Sequence Diagrams)*

*   **9.1 Use Case Diagram:** Shows features offered by Athenea Manager and the users who interact with them.
*   **9.2 Component Diagram:** Explains how Athenea Manager is internally structured and which components communicate with one another.
*   **9.3 Deployment Diagram:** Illustrates the deployment of frontend, backend, database components alongside external services.
*   **9.4 Sequence Diagrams:** Includes authentication, project registration, proposal review, and AI assistant dynamic behavior.

---

## 10. Security and Privacy

### 10.1. Authentication and Authorization Mechanisms.
Authentication and authorization are enforced centrally by the Authentication and Access Control module, implemented with BetterAuth.

**Authentication mechanisms**
*   Registration and identity (RF-010, BR-005).
*   Password storage (RF-010, RNF-006): Passwords are hashed with bcrypt.
*   Brute-force and enumeration protection (RF-010).
*   Password reset (RF-010).
*   OAuth 2.0 institutional login (RF-015).
*   Sessions and tokens.

**Authorization (role-based access control)**
Authorization follows the role-based model required by RF-001 and operates at two levels: Platform roles and Project roles.

| Role | Main capabilities | Key restrictions |
| :--- | :--- | :--- |
| **Principal Investigator** | Registers projects, manages activities and documents, configures document visibility, invites team members, registers research products. | Must hold the Tenured Researcher status; at most 3 active projects; cannot enroll relatives; cannot review own or own-department projects. |
| **Student** | Contributes to assigned activities and uploads progress evidence. | Can update only milestones assigned to them. |
| **Coordinator** | Monitors progress across projects. | Receives role-shaped summary data only; cannot see confidential projects unless authorized. |
| **Committee** | Takes part in proposal review. | Excluded from projects with a family or departmental conflict of interest. |
| **Administrator** | Manages roles and platform-wide settings, publishes calls for proposals. | Cannot access Team-only documents, except mandatory review documents. |
| **AI Assistant (system actor)** | Retrieves authorized fragments and answers questions with citations. | Strictly read-only; receives only fragments the querying user may view. |

### 10.2. Data protection and vulnerability prevention

| Threat | Design countermeasures | Related requirements |
| :--- | :--- | :--- |
| **SQL injection** | All data access goes through Prisma ORM with parameterized queries. | RNF-010, RF-012 |
| **Cross-site scripting (XSS)** | React escapes rendered output by default; user-provided content is never injected as raw HTML. | RNF-010, AIR-003 |
| **Cross-site request forgery (CSRF)** | Tokens are sent in the Authorization header. OAuth flow validates the state parameter. | RNF-010, RF-015 |
| **Broken access control** | Authorization is checked on every request. Identifiers are sequential integers; unauthorized resources return 403 or 404. | RF-001, BR-007 |
| **Insecure file upload** | Only PDF, PNG, JPG, and XLSX are accepted, validated by magic number. Files are limited to 25 MB each. | RF-016, RNF-005 |
| **Prompt injection and jailbreaks** | Input sanitization and a hardened system prompt. Retrieved fragments are passed as delimited data. | AIR-002, AIR-004, AIR-005 |
| **Brute force and DoS** | Account lockout after 5 failed attempts, maximum password length, rate limiting, and server-side pagination. | RF-010, RF-013, RNF-008 |
| **Sensitive data exposure** | TLS for all traffic. Sensitive personal data is encrypted at rest with AES-256-GCM. | RNF-001, RNF-006, RNF-010, RNF-008 |

### 10.3. Information Retention and Privacy Policies.

| Data category | Retention and disposal rule | Protection | Source |
| :--- | :--- | :--- | :--- |
| **User accounts and credentials** | Kept while the account is active. When an account is deleted, the user record is anonymized. | bcrypt hash; lockout counters; generic error messages. | RF-010, RNF-006 |
| **Project data and documents** | Kept for the lifetime of the project. At most 5 proposal revisions are retained. | Document visibility; signed URLs; Confidential flag. | RF-004, RF-005, RF-016, RF-020, BR-007 |
| **Personal data of human-subject research** | Stored only in encrypted or pseudonymized form. Primary databases are securely and irreversibly deleted 5 years post-completion. | AES-256-GCM with KMS keys; fail-closed behavior. | RNF-001, BR-012, BR-013 |
| **Audit log** | Permanent and immutable. | Insert-only; UTC timestamps; actor, target, and source IP recorded. | RF-017 |

---

## 11. Error and Exception Handling

### 11.1. Critical Failure Scenarios
The error-handling approach follows these principles: Fail closed, Isolate optional integrations, Consistent error contracts, No internal details exposed, and Visible feedback.

| ID | Condition | System response | User feedback | Recovery |
| :--- | :--- | :--- | :--- | :--- |
| **F-01** | External LLM API reaches its rate limit. | The error is caught; the SSE stream emits an error event. | Message stating that the assistant is temporarily saturated. | The user resubmits the query. Usage is monitored. |
| **F-02** | The generated answer has no valid citation. | Generation is aborted before it reaches the interface. | "Information not found" message. | The user rephrases the question. |
| **F-04** | KMS unreachable. | Fail closed: encryption and decryption are blocked. | Message stating that the protected data is temporarily unavailable. | Retry with backoff; the administrator is alerted. |
| **F-05** | Antivirus scanner times out. | The upload is rejected with HTTP 503 and nothing is saved. | Message stating that the file could not be verified as safe. | The user retries the upload. |
| **F-08** | Database unavailable. | Requests fail with a generic HTTP 503; open transactions roll back. | Generic message that the service is temporarily unavailable. | Automatic reconnection; the administrator is alerted. |

*(Additional failure scenarios exist in full document)*

---

## 12. Non-Functional Requirements in Design

### 12.1. Matrix of NFRs vs. Design Decisions.

| Category | Requirement and target | Design decisions | Verification |
| :--- | :--- | :--- | :--- |
| **Performance** | RNF-002: P95 of HTTP requests under 3.0 s with 500 concurrent users. RF-008 and RF-013: pages and dashboards under 3 s. | GraphQL field selection avoids over-fetching; server-side pagination; dashboard cache of at most 15 minutes; asynchronous background jobs. | K6 load tests with 500 simulated users; Jest integration tests for pagination and caching. |
| **Performance** | RNF-008: rate limiting for the external LLM API. | Per-user rate limiting on `/ai/query`. | Tests that simulate provider errors. |
| **Availability** | RNF-003: 99.9% annual uptime. RNF-009: automated backups at least every 24 hours. | Stateless JWT-based backend; `/health` endpoint; optional integrations isolated. Daily automated backups of the database. | External uptime monitoring; Periodic test restoration. |
| **Usability** | RNF-007: support for Chrome, Firefox, and Edge. RNF-004: responsive interface. | Responsive layouts in React and Next.js; persistent error notifications; accessible forms. | Automated accessibility checks; cross-browser smoke tests. |

---

## 13. Technical Decisions and Justification (ADR)

### 13.1. Record of at least 5 critical architectural decisions

| Decision | Alternatives | Selected Option | Rationale | Consequences |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | MySQL / PostgreSQL / MongoDB | PostgreSQL | Relational data and constraints; transactional integrity. | Requires relational schema design and migrations. |
| **Backend style** | Microservices / Modular monolith / Unstructured monolith | Modular monolith | Matches team size and limited timeline; avoids operational overhead of microservices. | All modules share a single deployment lifecycle. |
| **API style** | Pure REST / Pure GraphQL / Hybrid | Hybrid (REST + GraphQL + SSE) | Different operations have fundamentally different needs. | Increases the number of concepts the team must learn and document. |
| **AI architecture** | Locally hosted LLM / Direct external LLM / RAG + external LLM API | RAG + external LLM API | No dedicated GPU infrastructure available; RAG grounds responses in authorized documents. | Response quality depends on retrieval accuracy; subject to external rate limits. |
| **Vector storage** | Dedicated vector database / pgvector | pgvector on the existing PostgreSQL instance | Avoids introducing and maintaining a separate database technology. | Vector search performance may not scale as well as a purpose-built database under large corpora. |

---

## 14. Technical Risks and Open Questions

### 14.1. Matrix of unresolved technical risks prior to implementation.

| ID | Risk or open question | Severity | Affects | Proposed mitigation or decision needed |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | The selected model, Gemini 1.5 Flash, has been retired by Google. | High | Sections 3, 6.2, 7.2; AIR-001 | Select a currently supported model and confirm its free-tier limits. |
| **R-02** | Authorized but confidential fragments are sent to a third-party LLM. | High | RNF-001, BR-007 | Review the provider's data-use terms before use. |
| **R-03** | Hostinger is the only hosting option; plan limits may be exceeded. | High | RNF-002, RNF-003, RNF-009 | Confirm the plan SLA and run load tests on the target environment early. |
| **R-04** | Institutional KMS availability is unconfirmed. | High | RNF-001, BR-012 | Confirm availability. If unavailable, define a documented fallback. |
| **R-10** | RAG quality is uncertain: document formats are inconsistent. | Medium | AIR-001, AIR-003, AIR-004 | Limit initial scope to defined document types. Build an evaluation set with LangWatch. |

*(Additional risks noted in full document)*

---

## 15. Traceability Matrix

### 15.1. Final mapping

| Requirement | Architecture Component | UI | Database | API | Diagram |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-001, RF-010** | Authentication and Access Control | Login | Users | `POST /auth/login`, `POST /auth/register` | Sequence Diagram 1 |
| **RF-015** | Authentication and Access Control | Login | Users | `GET /auth/oauth/callback` | Sequence Diagram 1 |
| **RF-002** | Project Lifecycle Management | Project Registration | Project, Project_User | Mutation `registerProject` | Sequence Diagram 2 |
| **RF-003, RF-019** | Evaluation, Project Lifecycle Management | Detail View and Documents | Project | Mutation `submitProjectDecision` | Sequence Diagram 3 |
| **RF-004** | Project Lifecycle Management | Detail View and Documents | Document | Mutation `uploadRevisedProposal` | Sequence Diagram 3 |
| **RF-005** | Documents and Evidence | Detail View and Documents | Document | Mutation `setDocumentVisibility` | Component Diagram |
| **RF-016** | Documents and Evidence | Detail View and Documents | Document | `POST /projects/:id/documents`, `GET /documents/:id/download` | Sequence Diagram 2 |
| **RF-006, RF-007** | Milestones and Monitoring, Project Lifecycle Management | Coordinator Dashboard, Detail View | Milestone, Product | Mutation `createMilestone`, `updateMilestoneProgress`, `registerResearchOutput` | Component Diagram |
| **RF-008** | Reporting | Coordinator Dashboard | Project, Milestone | Query `coordinatorDashboard`, `statisticalReport` | Component Diagram |
| **RF-017** | Audit and Compliance | Detail View and Documents | Audit_Log | Query `auditLog` | Component Diagram |
| **AIR-001 to AIR-005** | AI Assistant (RAG) | AI Assistant | Document (Vector Index) | `POST /ai/query` (SSE) | Sequence Diagram 4 |