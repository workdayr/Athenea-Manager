# Athenea Manager --- Software Requirements Specification

Index Index 1 1. Introduction 2 1.1 Purpose 2 1.2 Project background 2
1.3 Problem addressed 2 1.4 Intended audience 2 1.5 Definitions and
terminology 3 2. Product Overview 3 2.1 Product perspective 3 2.2
Product objectives 4 2.3 Stakeholders 5 2.4 Actors 6 2.5 System
boundaries 6 2.6 Assumptions 6 2.7 Constraints 7 2.8 Dependencies 7 3.
Scope 7 3.1 In-scope functionality 7 3.2 Out-of-scope functionality 8
3.3 Future functionality 8 4. Current Situation 8 4.1 As-Is process 8
4.2 Current problems 8 4.3 Current information sources 9 4.4 Identified
opportunities 9 5. Proposed Solution 9 5.1 To-Be process 9 5.2 Expected
system capabilities 10 5.3 General interaction with users and external
systems 11 6. Functional Requirements 11 RF- 001 11 RF- 002 12 RF- 003
13 RF- 004 13 RF- 005 14 RF- 006 14 RF- 007 15 RF- 008 16 RF- 009 16 RF-
010 17

       RF- 011                                                         17
       RF- 012                                                         18
       RF- 013                                                         19
       RF- 014                                                         19
       RF- 015                                                         20
       RF- 016                                                         20
       RF- 017                                                         21
       RF- 018                                                         22
       RF- 019                                                         22
       RF- 020                                                         23

7.  Non-Functional Requirements 24 RNF- 001 24
8.  Business Rules 24
9.  AI Requirements 25 AIR - 001 25 AIR - 002 25 AIR - 003 26
10. Use Cases 26 \### UC-002 --- Research Project Registration 28 \###
    UC-003 --- Project Proposal Review and Evaluation 29 \### UC-004 ---
    Upload Revised Proposal Version 29 \### UC-005 --- Document
    Visibility Configuration 30 \### UC-006 --- Definition and Tracking
    of Milestones and Activities 30 \### UC-007 --- Student Progress
    Evidence Upload 31 \### UC-008 --- Research Products Registration 31
    \### UC-009 --- Dashboard and Statistical Reports Generation 32 \###
    UC-010 --- AI Assistant Inquiry (RAG) 32 \### UC-011 --- Optional
    Budget Management 33
11. Requirements Prioritization 34 MoSCoW classification. 34
12. Open Issues 34 Questions that remain unresolved. 34

# 1. Introduction

## 1.1 Purpose

This document defines the requirements, scope, and initial planning for
Athenea Manager. A centralized platform for managing the full lifecycle
of university research projects. It is intended to serve as a guide for
the development team, academic evaluators, and institutional
stakeholders through the problem being solved, the boundaries of the
system, and the functional and non-functional expectations that will
drive design and implementation decisions.

## 1.2 Project background

The project is to be developed by the team Zellara Software Solutions as
part of the Software Projects Management course within the Software
Engineering (ISW) program at Universidad Politécnica de Durango. The
project responds to a real operational need identified at the
institutional level: absence of a unified system for coordinating
research activity across departments, researchers, and administrative
staff.

## 1.3 Problem addressed

The university currently manages the research project lifecycle
(proposals, protocols, milestones, evidence, reports, and publications)
through disconnected files, emails, and spreadsheets. This produces four
recurring problems: - Fragmented information: scattered across
individual researchers' personal files and communication channels. -
Limited visibility: preventing coordinators from monitoring milestones,
deadlines, and status across multiple projects at once. - Evaluation
friction: since proposal review depends on manually assembled
documentation. - Confidentiality risk: as sensitive or unpublished
research data circulates through informal, loosely controlled channels.

## 1.4 Intended audience

This document is intended for: - The project sponsor, who approves scope
and validates deliverables. - Institutional executives, who oversee
compliance with data-handling and confidentiality policies. -
Researchers, who will use the platform to manage their projects. -
Students, who will track their participation and contribute evidence. -
The development team, as the primary reference for design and
implementation.

## 1.5 Definitions and terminology

-   RAG (Retrieval-Augmented Generation): an AI architecture that
    retrieves relevant document fragments before generating a response,
    grounding answers in authorized sources.
-   RBAC (Role-Based Access Control): an access model that restricts
    system functionality and data visibility according to a user's
    assigned role.
-   LLM (Large Language Model): the external AI model consumed via API
    to generate natural-language responses.
-   LFPDPPP: Mexico's Federal Law on the Protection of Personal Data
    Held by Private Parties, governing the handling of sensitive
    personal data such as professional license numbers.
-   WBS (Work Breakdown Structure): the hierarchical decomposition of
    the project into manageable work packages.
-   SAST/DAST: static and dynamic application security testing practices
    and tooling used during the security assurance phase.
-   Scrumban: the hybrid Scrum/Kanban framework guiding the project's
    sprint planning.

# 2. Product Overview

## 2.1 Product perspective

Athenea Manager is a new, standalone platform intended to replace the
current patchwork of files, emails, and spreadsheets used to manage
research projects. It centralizes documentation, communication, and
workflow tracking in a single system, and augments it with an AI-based
knowledge assistant that helps users navigate institutional procedures
without replacing human judgment or formal decision-making.

## 2.2 Product objectives

1)  Centralize the full research-project lifecycle (submission,
    evaluation, planning, execution, monitoring, reporting, and closure)
    in one system. This is the platform's core objective and the direct
    response to the fragmentation problem described in the current
    situation. Rather than treating each lifecycle stage as a separate,
    loosely connected activity handled through files and email, Athenea
    Manager models the lifecycle as a single continuous workflow with
    enforced status transitions (Proposed → Under Review → Approved →
    Active → Completed → Closed, with Rejected/Suspended as exit
    states).
2)  Provide role-appropriate functionality to researchers, students,
    coordinators, evaluators, and administrators. Rather than exposing
    one generic interface to every user, the system tailors what each
    actor can see and do to their actual responsibilities: researchers
    manage their own projects, documents, and evidence; students engage
    with the activities assigned to them; coordinators get cross-project
    visibility rather than per-project detail; evaluators receive
    exactly the documentation needed to render a decision; and
    administrators manage roles and configuration without touching
    research content itself.
3)  Maintain consistent, traceable storage and organization of project
    documentation and evidence. Today, documentation quality and
    completeness depend entirely on individual researchers' personal
    habits. This objective standardizes that: every project carries a
    minimum required set of documents every proposal revision is
    preserved with its full history rather than overwritten. The result
    is that a project's documentation trail is reconstructable at any
    point, which is what makes reliable evaluation, auditing, and
    long-term archival possible in the first place.
4)  Offer AI-assisted knowledge support, grounded in authorized
    institutional and project documents, with source traceability and
    strict confidentiality controls. This objective addresses a narrower
    but high-value problem: the time researchers, students, and staff
    currently lose manually searching for institutional procedures and
    regulations. The project is intended to support the assistant
    questions using a RAG architecture, meaning it can only respond
    using content actually retrieved from authorized sources.

Together, these four objectives form a deliberate progression: objective
1 gives the institution one system instead of many; objective 2 makes
that system usable and secure by tailoring it to each actor; objective 3
ensures what's stored in it can be trusted and reconstructed; and
objective 4 layers a knowledge-support tool on top that respects the
access boundaries the first three objectives establish.

## 2.3 Stakeholders

Role Interest expectation Influence Responsibilities

                                             Primary stakeholder

Project Sponsor That the platform Receive a High Approve project solves
the centralized, scope and fragmented functional objectives,
research-project platform provide management delivered within
institutional problem the limited resources, make (scattered files,
academic final decisions, emails, timeframe, with a validate key
spreadsheets) reliable and deliverables secure AI assistant

Executives Institutional That the system High Approve efficiency, aligns
with data-handling protection of institutional policies, support
confidential policies and that the project research the AI does not
institutionally, information, expose oversee that regulatory
confidential development compliance information to complies with
unauthorized confidentiality users guidelines

                                        secondary stakeholders

Research Easily manage An intuitive tool Medium Use the platform Leaders
proposals, that centralizes to track their activities, their research
projects, upload milestones, work and a documentation/e documents,
useful AI vidence, provide collaborators, assistant for feedback to the
and evidence for questions about team on their projects institutional
requirements procedures

Researchers Visibility into their A clear, Low Participate in
participation in easy-to-use assigned research projects interface to
track activities within and access to tasks and the project, use
relevant milestones they the documentation contribute to corresponding
dashboard, provide progress evidence

## 2.4 Actors

-   Main Researcher: registers projects, manages activities and
    documents, configures document visibility.
-   Student: contributes to assigned activities and uploads progress
    evidence.
-   Coordinator: monitors progress across multiple projects and
    identifies projects falling behind schedule.
-   Committee: reviews proposals and issues approval, rejection, or
    modification decisions.
-   Administrator: manages roles and oversees platform-wide
    configuration.
-   AI Assistant (system actor): retrieves authorized content and
    answers procedural or project-related questions in natural language,
    operating strictly under read-only permissions.

## 2.5 System boundaries

The platform covers the core phases of the research lifecycle: design
and planning, data gathering, analysis and processing, divulgation and
publication, and conservation. Its core purpose is to centralize
documentation and communication so that project managers can track
progress without relying on scattered PDFs, spreadsheets, and images,
while also supporting the university's issuance and tracking of research
proposal calls and the archival of completed projects.

## 2.6 Assumptions

-   Existing institutional roles do not need to be redefined; users will
    migrate their current informal workflows into the new platform
    as-is.

## 2.7 Constraints

-   Limited academic budget and timeline.
-   No dedicated GPU infrastructure, ruling out locally hosted LLMs.
-   Usage subject to rate limits imposed by free-tier external LLM APIs.
-   Strict confidentiality requirement: the AI assistant must never
    disclose confidential research information to unauthorized users.

## 2.8 Dependencies

-   An external LLM API provider for response generation.
-   Existing institutional data and access-control policies that the
    platform's RBAC and retrieval filtering must respect.

# 3. Scope

## 3.1 In-scope functionality

The system will have the main purpose of centralizing the documentation
and communication from the research team in order to allow the project
manager to have a better understanding of what is getting done and how
much the team has advanced, instead of having several documents like
pdfs, spreadsheets, images, etc. This will also help the university
issue calls for proposals for research projects and keep constant track
of all participants in the call, thereby providing a more accurate
picture of what is happening; and upon completion of the projects, it
will enable the university to create a comprehensive database of
approved projects for archival purposes. - Centralized project lifecycle
management. - Role-based access control (RBAC). - Repository for
documents, milestones, and evidence with configurable visibility
settings (public/private). - Virtual assistant based on RAG architecture
with source citations. - Dashboards with real-time metrics.

## 3.2 Out-of-scope functionality

-   Broader institutional procedures: The initial implementation will
    focus on a defined subset of processes and document types, leaving
    the management of other general institutional procedures for future
    expansion.
-   AI-powered automated decision-making: The AI assistant will provide
    informative responses, but will in no way replace institutional
    policies, regulations, or formal decisions made by human evaluators.
-   Institutional Human Resources Management: Hiring, termination,
    benefits administration, or employment records for faculty and
    researchers will not be managed here. The system will be limited to
    assigning roles to existing institutional users.

## 3.3 Future functionality

-   Expansion to cover additional institutional procedures and document
    types beyond the initial implementation.
-   Evaluation and adoption of paid LLM API tiers to support
    production-scale usage beyond academic rate limits.
-   Potential extension of the AI assistant's authorized document body
    as institutional adoption grows.

# 4. Current Situation

## 4.1 As-Is process

Today, each research project follows an informal, largely undocumented
workflow. Proposals are drafted and shared via email or personal file
storage; evaluation and follow-up rely on manually assembling
documentation from multiple sources; and progress tracking depends on
the communication between researchers and coordinators rather than a
shared system of record.

## 4.2 Current problems

-   Information about a given project is dispersed across individual
    researchers' personal files, inboxes, and spreadsheets, with no
    single source of truth.
-   Coordinators lack a consolidated view of progress across projects,
    making it difficult to monitor milestones, deadlines, and overall
    status.
-   Proposal evaluation and ongoing follow-up depend on documentation
    assembled manually for each review, slowing the process.
-   Access to sensitive or unpublished research data is poorly
    controlled, since it moves through informal channels such as
    personal email and shared spreadsheets.

## 4.3 Current information sources

-   Individual researchers' personal file storage.
-   Email threads between researchers, students, and coordinators.
-   Personal or shared spreadsheets used to track status and milestones.

## 4.4 Identified opportunities

-   Replacing scattered files and communication with a single system of
    record for the entire project lifecycle.
-   Giving coordinators a consolidated, real-time view of progress
    across all active projects.
-   Reducing the manual effort required for proposal evaluation by
    structuring documentation requirements up front.
-   Enforcing consistent, role-based access control to reduce the
    confidentiality risk currently inherent in informal information
    sharing.
-   Introducing an AI assistant to reduce the time spent manually
    searching for institutional procedures and regulations, without
    compromising confidentiality or institutional authority over
    decisions.

# 5. Proposed Solution

## 5.1 To-Be process

Athenea Manager formalizes the research lifecycle into a structured,
seven-step workflow: 1. Register project: A researcher registers a new
project by submitting the required core information along with the
minimum set of supporting documentation (hypothesis, abstract,
methodology, rationale, results). The project cannot advance until these
requirements are complete.

2.  Assign researchers: Collaborators and team members are formally
    associated with the project, establishing who has access to it and
    in what capacity, in line with the platform's role-based access
    model.
3.  Submit documents: Supporting evidence, revisions, and additional
    documentation are uploaded and attached to the project, with
    visibility settings configured at the document level (shared with
    administration or kept private to the team).
4.  Review: The submission enters the administrative review workflow,
    where the evaluation committee examines the proposal and its
    documentation, recording review minutes as part of the process.
5.  Approve / reject: The committee issues a formal decision (approval,
    rejection, or a request for modification) which is recorded and
    drives the project's status transition (Proposed →
    Approved/Rejected, or back to the researcher for a revised version,
    preserving full version history).
6.  Update status: Once approved, the project moves through its active
    lifecycle states (Active, Completed, Closed, or Suspended).
    Researchers report progress on milestones and activities, while
    coordinators monitor status changes and identify projects falling
    behind schedule.
7.  Generate reports: At any point in the lifecycle, and formally at
    closure, the system generates statistical and administrative
    reports, and completed outputs and evidence are archived for
    institutional record-keeping.

## 5.2 Expected system capabilities

-   Access control: role-based restrictions on all processes, actions,
    and documentation, with roles assigned rather than self-selected.
-   Project registration: structured capture of core project data and
    required supporting documents, with validation before a project can
    be registered.
-   Lifecycle and approval workflow: enforced status transitions with a
    recorded administrative review process.
-   Version history: chronological tracking of proposal revisions
    alongside committee comments and decisions.
-   Document-level visibility: principal investigators can restrict
    specific documents from administrative view.
-   Milestone tracking: activity definition, progress reporting, and
    coordinator-facing views that surface delayed projects.
-   Outputs registry: linking of publications, software, patents, and
    theses to their originating project and researchers.
-   Dashboards and reporting: real-time administrative metrics on
    project counts, status, areas, budget, and researcher productivity.
-   AI assistant: RAG-based natural-language responses to procedural and
    project-related questions, generated only from authorized, retrieved
    content, with every response citing its source document, and
    operating under strict read-only permissions with no ability to
    modify or approve project information.
-   Optional budget tracking: expense logging against a project's
    allocated budget, enabled at the team's discretion.
-   Regulatory compliance: encryption and restricted access for
    sensitive personal data in line with the LFPDPPP.

## 5.3 General interaction with users and external systems

Users interact with the platform through role-specific dashboards:
researchers manage their own projects and documentation, students engage
with assigned activities, coordinators and evaluators oversee and review
submissions, and administrators manage roles and platform-wide settings.
When a user queries the AI assistant, the request is first filtered
through the same role- and project-based access control enforced
elsewhere in the platform; only fragments the requesting user is already
authorized to view are retrieved from the pgvector-indexed document
store and passed as context to the external LLM API, which generates a
natural-language response with an explicit citation back to its source.
If no authorized, relevant fragment is found, the assistant states this
explicitly rather than producing an unsupported answer. The assistant's
role is strictly advisory. Final decisions on approvals, evaluations,
and project status remain with human evaluators and coordinators.

# 6. Functional Requirements

ID RF- 001

TITLE: Role-Based Access Control

ID RF- 001

DESCRIPTION: Access to processes, actions, or documentation will be
restricted based on a user's role. The system must deny unauthorized
access by returning an HTTP 403 error (API) or redirecting to an "Access
Denied" page (UI), validating permissions against a centralized RBAC
matrix on every request.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Users can only access sections allowed by their role.
Unauthorized CRITERIA: attempts immediately result in a 403 error or
redirection, and roles cannot be manually selected or changed by the
user.

ID RF- 002

TITLE: Research Project Registration

DESCRIPTION: Registration requires: title (\<=300 characters),
objectives (\<=2000 characters), researcher list with PI designation,
start/end dates (end \> start), and exactly 5 required documents
strictly in PDF format. The system must validate the PI does not exceed
the active project limit (BR-002) before submission.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ID RF- 002

ACCEPTANCE The system successfully registers the project in "Proposed"
status CRITERIA: only if all text limits are respected, documents are
valid PDFs, and the PI hasn't exceeded the 3-project limit.

ID RF- 003

TITLE: Life Cycle Management and Approval Workflow

DESCRIPTION: Implement the state machine: Proposed -\> Under Review -\>
{Approved -\> Active -\> Completed / Closed / Rejected / Suspended /
Modification Requested -\> Under Review}. The system will enforce clear
bidirectional transition rules for the "Suspended" state and establish
an SLA time limit for the "Under Review" state (e.g., 30 days) that
triggers automated alerts to administrators.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Every transition logs actor, timestamp, previous/new status,
and CRITERIA: justification. "Under Review" projects exceeding 30 days
trigger an admin alert. 100% of illegal transitions are rejected.

ID RF- 004

TITLE: Proposal Versions and History

ID RF- 004

DESCRIPTION: Each revision upload creates an immutable, timestamped
version. To optimize storage, the system will retain a maximum of 5 full
revisions per project, which count towards the total 500 MB project
quota (RF-016). Uploads are permitted only when a 'Modification
Required' decision is active.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE The system maintains a chronological history of up to 5
proposal CRITERIA: versions and committee comments, blocking further
uploads if the limit or quota is exceeded.

ID RF- 005

TITLE: Document-Level Visibility Settings

DESCRIPTION: PI sets each document to 'Team-only' or 'Shared with
administration'. The system will enforce business rules by preventing
mandatory evaluation documents (protocols, ethics approvals) from being
marked as 'Team-only', forcing administrative visibility.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ID RF- 005

ACCEPTANCE Administrative users cannot access private documents, except
for CRITERIA: mandatory review documents which the system strictly
prevents the PI from hiding.

ID RF- 006

TITLE: Tracking Milestones and Activities

DESCRIPTION: Milestones require name, assignee, due date, and status. A
scheduled system job (cron) will automatically flag the activity as
"Delayed" at 00:01 (America/Mexico_City timezone) on the 7th day past
the due date if no status update has occurred, triggering UI highlights.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Delayed activities are accurately flagged at the exact
specified CRITERIA: time without manual intervention, highlighting them
in the coordinator's view.

ID RF- 007

TITLE: Research Outputs Registry

DESCRIPTION: Register outputs of exactly five types (journal article,
conference presentation, software, patent, thesis). If the optional URL
or DOI is

ID RF- 007 provided, the system must validate its format using a
standard regular expression before allowing the registration in the
database.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Users can associate valid outputs to a project. URL/DOI
inputs fail CRITERIA: validation and display an error if they do not
match standard web or DOI regex patterns.

ID RF- 008

TITLE: Dashboards and Statistical Reports

DESCRIPTION: Dashboards show project counts, budget spent, and
productivity. The dashboard backend will calculate and render metrics
with a maximum cache time of 15 minutes to reduce database load,
supporting a default date range filter of the "current year".

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Management views automated reports that load within CRITERIA:
performance limits (\<=3s), displaying cached data no older than 15
minutes.

ID RF- 009

TITLE: Optional Budget Management

DESCRIPTION: The PI enables the budget module per project. The MXN
amount field will strictly accept positive numerical values with exactly
2 decimal places and a maximum value of 9,999,999.99 per record,
rejecting any negative or non-numeric inputs.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE Teams can record valid financial expenses, and the system
strictly CRITERIA: rejects negative, non-numeric, or out-of-bounds
amounts.

ID RF- 010

TITLE: User Authentication and Registration

DESCRIPTION: Registration requires a verified email. Passwords must be
between 8 and 64 characters long to prevent DoS attacks. Storage will
use bcrypt with a cost factor of 12. 5 failed attempts lock the account
for 15 minutes. Password resets use a 30-minute expiry token.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ID RF- 010

ACCEPTANCE Users register and log in successfully. Passwords outside the
8-64 CRITERIA: length limits are rejected. Passwords are securely hashed
using bcrypt cost 12.

ID RF- 011

TITLE: Research Teams Management

DESCRIPTION: PI invites platform users via a 7-day expiring email. The
system will validate before sending the invitation that the target user
has no family conflicts of interest with the PI (BR-010) and is eligible
to join based on their current active project load.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Invitations are only dispatched if the target user passes
strict CRITERIA: business rule validations for project limits and
conflict of interest declarations.

ID RF- 012

TITLE: Internal Research System

ID RF- 012

DESCRIPTION: The system will implement a case-insensitive Full-Text
Search (FTS) engine across completed projects, calls for proposals,
users, and ongoing projects, returning results ordered by lexical
relevance.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Users can search and find items through exact or partial word
CRITERIA: matches, with the most relevant results appearing first.

ID RF- 013

TITLE: Data Filtering and Sorting

DESCRIPTION: Publish per-section filter/sort tables. To ensure
performance, all filterable data tables will implement server-side
pagination with a maximum of 50 records per page, ensuring load times
remain under 3 seconds.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Filtering returns exact matches, and results are paginated at
50 CRITERIA: per page, maintaining UI performance regardless of database
size.

ID RF- 014

TITLE: Transactional Notifications

DESCRIPTION: Display in-app notifications for action outcomes. Success
notifications auto-dismiss after 5s, but error or warning notifications
will persist on screen until manually dismissed by the user to comply
with WCAG accessibility standards.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Error and warning messages remain visible until explicitly
CRITERIA: acknowledged, while success messages disappear automatically.

ID RF- 015

TITLE: Social Login Integration (OAuth)

DESCRIPTION: Offer OAuth 2.0 login. Access will permit registration for
users with institutional emails from the host university, as well as
previously authorized external academic or corporate domains (complying
with BR-005). On the first OAuth login with an email matching an
existing account, link the accounts after password confirmation,
importing only name and email. If the provider fails, the system will
fall back to traditional email/password login.

PRIORITY: High/Essential Medium/Desired Low/Optional

ID RF- 015

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE External authentication succeeds for both the institutional
domain CRITERIA: and authorized external academic/corporate domains.
Accounts are linked successfully if the email matches and the password
is validated.

ID RF- 016

TITLE: Files Upload and Management

DESCRIPTION: Accept formats: PDF, PNG, JPG, XLSX (max 25 MB/file, 500
MB/project). Uploaded files will be validated by hexadecimal signature
(Magic Numbers) and passed through an automated antivirus scan before
being saved to persistent storage.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE System stores files only if they match the allowed magic
numbers CRITERIA: and pass the malware scan, strictly enforcing the 25
MB file limit.

ID RF- 017

TITLE: Activity History

DESCRIPTION: Log actions (file changes, status transitions, role
changes) with actor, target ID, source IP, and UTC timestamp. Audit logs
will be immutable and stored permanently in the system, even after the
project is archived (Closed status).

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE All specified actions create an immutable log that remains
CRITERIA: queryable indefinitely for auditing purposes.

ID RF- 018

TITLE: Publication of Calls for Project Proposals

DESCRIPTION: Administrators publish calls with key dates and optional
application caps. The automatic closure upon reaching the application
cap will use database Row-Level Locking to guarantee that concurrent
application transactions do not exceed the maximum allowed limit.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ID RF- 018

ACCEPTANCE Calls close precisely at the deadline or cap limit, with race
CRITERIA: conditions strictly prevented by row-level locking.

ID RF- 019

TITLE: Project Approval

DESCRIPTION: The Committee records decisions with mandatory
justification. The PDF generation of the decision report will be
asynchronous; the system informs the user in under 3 seconds and
provides a download link once rendering is complete.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Decisions are saved immediately, and the PDF is generated
CRITERIA: asynchronously without blocking the user interface.

ID RF- 020

TITLE: Filing of Approved Projects

DESCRIPTION: When a project reaches Closed status, a daily job freezes
it into a read-only archive. This archival process will operate under
strict ACID transactions; if it fails at any point, it will completely
roll back and alert the System Administrator.

ID RF- 020

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE Projects are cleanly archived to a read-only state. Partial
or failed CRITERIA: archives trigger an alert and roll back to ensure
data integrity.

# 7. Non-Functional Requirements

ID RNF- 001

TITLE: Privacy and Compliance with the LFPDPPP

DESCRIPTION: Sensitive personal data will be stored encrypted at rest
using the AES-256-GCM algorithm, with keys managed by an institutional
KMS. Access is restricted exclusively to the PI and authorized team
members via RBAC.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE Database audits confirm sensitive fields are AES-256-GCM
CRITERIA: encrypted and inaccessible to unauthorized users.

ID RNF- 002

TITLE: Performance and Response Times

DESCRIPTION: The 95th percentile (P95) of the system's HTTP requests
must complete in under 3.0 seconds under a concurrent test load of 500
simulated users.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE Performance testing tools demonstrate P95 \<= 3.0s with 500
CRITERIA: concurrent users.

ID RNF- 003

TITLE: Availability

DESCRIPTION: The system will guarantee an annual Uptime of 99.9%,
allowing a maximum of 8.76 hours of unplanned downtime. Scheduled
maintenance windows are excluded and must be notified 2 months in
advance.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ID RNF- 003

ACCEPTANCE Monitoring tools reflect at least 99.9% uptime per rolling
12-month CRITERIA: period.

ID RNF- 004

TITLE: Usability and Accessibility

DESCRIPTION: The interface must be responsive, adapting correctly to
screen resolutions from 320px (mobile devices) to desktop screens.
Additionally, it must mandatorily comply with WCAG 2.1 level AA web
accessibility standards to ensure it can be used on any device.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE The interface remains user-friendly, scales properly across
CRITERIA: specified screen resolutions, and passes WCAG 2.1 AA
accessibility validation.

ID RNF- 005

TITLE: Secure File Storage and Handling

DESCRIPTION: The system must support the upload of documents with a
maximum size of 25 MB per file and enforce a 500 MB quota per

ID RNF- 005 project. Links to these resources must be temporarily signed
to prevent unauthorized direct access by URL.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE The system allows uploading files up to 25 MB, stores them
CRITERIA: properly preventing data loss, and restricts direct file
access through signed URLs.

ID RNF- 006

TITLE: Authentication Security

DESCRIPTION: User passwords must never be stored in plain text. They
must be hashed using robust cryptographic key derivation algorithms with
salting (specifically bcrypt or Argon2) to ensure secure authentication.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE The database stores passwords exclusively as bcrypt or Argon2
CRITERIA: salted hashes, completely preventing plain text retrieval.

ID RNF- 007

TITLE: Interoperability and Compatibility

DESCRIPTION: The web platform must be fully functional and maintain
visual consistency across the two latest stable versions of standard
modern web browsers (Google Chrome, Mozilla Firefox, and Microsoft
Edge).

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE The application renders correctly and all core functions
operate CRITERIA: without visual or functional errors on the specified
browser versions.

ID RNF- 008

TITLE: External AI API Rate Limiting

DESCRIPTION: Due to academic budget constraints, the system must
implement rate limiting for queries directed to the RAG assistant. If
the external LLM provider reaches its limit, the system must queue the
request or display a clear message indicating the service is temporarily
saturated.

PRIORITY: High/Essential Medium/Desired Low/Optional

ID RNF- 008

SOURCE OF THE REQUIREMENT

ACCEPTANCE The system catches API rate limit errors gracefully and
informs the CRITERIA: user clearly without crashing or leaking stack
traces.

ID RNF- 009

TITLE: Backup and Recovery

DESCRIPTION: The system must execute automated backups of the
transactional database and file repositories at least once every 24
hours. These backups must guarantee a maximum Recovery Point Objective
(RPO) of 24 hours in the event of a critical infrastructure failure.

PRIORITY: High/Essential

SOURCE OF THE REQUIREMENT

ACCEPTANCE Automated backups are successfully generated daily, and a
test CRITERIA: restoration confirms data integrity up to the last 24
hours.

ID RNF- 010

TITLE: Application Security and Vulnerability Prevention

ID RNF- 010

DESCRIPTION: The system's codebase and architecture must be protected
against common web vulnerabilities, specifically mitigating the OWASP
Top 10 risks (e.g., SQL Injection, Cross-Site Scripting, CSRF). Security
must be validated using Static and Dynamic Application Security Testing
(SAST/DAST) tools during the development cycle.

PRIORITY: High/Essential

SOURCE OF THE REQUIREMENT

ACCEPTANCE The application must pass automated SAST and DAST security
CRITERIA: scans with zero critical or high-severity vulnerabilities
before any release to the production environment.

# 8. Business Rules

BR-001 Academic Requirement: Only a user with the "Tenured Researcher"
role can be designated as the Principal Investigator of a project.
BR-002 Duplicity Prevention: A Principal Investigator may not have more
than 3 active projects at the same time, unless he or she has an
exemption signed by the Office of Research. BR-003 Project Closure: A
project can only change its status to "Completed" if the Final Results
Report document has the status "Approved." BR-004 Evaluation
Exclusivity: A user with the role of Principal Investigator on a project
may not be appointed as a reviewer for their own project or for projects
within their own department (conflict of interest). BR-005 Identity
Verification: All users must register using an institutional email
address or an authorized academic/corporate domain.

BR-006 Ethics Approval: If the creation form indicates that the research
involves human subjects, animals, or sensitive data, the system will
block the change to "Approved" status until a valid document issued by
the Ethics Committee (IRB) is uploaded BR-007 Data Privacy: Projects
marked as "Confidential" will not appear in the platform's public search
results; they will only be visible to the project team and general
administrators. BR-008 Deadline Alerts: The system must generate and
send automatic notifications to the Principal Investigator 30, 15, and 5
days before the deadline for submitting a milestone. BR-009 Intellectual
Property and Publication: Upon completion of the project, it is
mandatory to register at least one derivative product (published
article, pending patent, conference paper, or data repository) that
includes the identification number (ID) assigned by the platform. BR-010
Restriction on Nepotism in Team Formation: The system will prohibit the
Principal Investigator (PI) from enrolling as a Co-Investigator,
Assistant, or in any paid role within the project individuals with whom
the PI has a blood or marital relationship (up to the third degree) or a
spousal relationship. When adding a new member to the team, the PI must
digitally sign an affidavit of "Absence of Family Conflict of Interest.
BR-011 Family Conflict of Interest in the Review Process: A reviewer may
not be assigned to a project (and must automatically decline the
assignment on the platform) if they have a family, civil, or marital
relationship with the Principal Investigator or any member of the
research team. If the system detects exact matches in last names between
the reviewer and the research team, it will trigger an automatic alert
that requires manual review by an Administrator before proceeding.
BR-012 Mandatory Anonymization of Human Subjects: For projects
classified under the category of "Human Subject Research," it is
strictly prohibited to upload documents or databases (Excel, CSV, etc.)
containing personally identifiable information (names, identification
documents, addresses, phone numbers) to the platform. The system will
require the Principal Investigator (PI) to certify that the datasets
have been pseudonymized or encrypted before allowing the file to be
uploaded. BR-013 Secure Data Destruction upon Closure: For projects
involving human subjects, when the status is changed to "Completed," the
system will activate a timer (in accordance with applicable local
regulations, e.g., 5 years). Once this period has elapsed, the platform
will perform a secure and irreversible deletion of the primary databases
hosted within the project, notifying the Principal Investigator 30 days
in advance. .

# 9. AI Requirements

ID AIR - 001

TITLE: RAG-Based Response Generation and Hallucination Prevention

DESCRIPTION: The assistant answers questions regarding institutional
procedures and project data strictly using retrieved authorized
fragments. If no relevant authorized snippet is retrieved, it must
explicitly state that it lacks sufficient information and must never
fabricate an answer. A persistent non-authoritative disclaimer must be
displayed in every session

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE The assistant generates natural language responses
exclusively CRITERIA: derived from the provided context. If the context
is empty or irrelevant, the system outputs a predefined refusal message
rather than an unsupported answer.

ID AIR - 002

TITLE: AI Modification Restriction (Read-Only)

DESCRIPTION: Under no circumstances should the AI assistant be able to
modify official project information, alter document statuses, or approve
projects. Its operation is strictly limited to querying and summarizing
existing data.

PRIORITY: High/Essential Medium/Desired Low/Optional

ID AIR - 002

SOURCE OF Dr. Elena Vargas (Stakeholder) THE REQUIREMENT

ACCEPTANCE The application strictly enforces read-only permissions for
the AI CRITERIA: model and API against both the transactional database
and the vector document store.

ID AIR - 003

TITLE: Traceability and UI Citations

DESCRIPTION: Every response generated by the AI must include explicit
citations pointing to the source documents used to formulate the answer.
Citations must show the document title and include a clickable
link/section pointing directly to the source.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE An automated validation ensures that 100% of successfully
CRITERIA: generated responses include at least one valid, clickable
citation mapping back to an authorized document.

ID AIR - 004

TITLE: RBAC Context Filtering for RAG

DESCRIPTION: Before sending any context to the external LLM API, the
retrieval engine must filter the vector search results based on the
querying user's assigned role and project permissions (RBAC). The AI
must never receive fragments from documents the user is not authorized
to view.

PRIORITY: High/Essential Medium/Desired Low/Optional

SOURCE OF THE REQUIREMENT

ACCEPTANCE Users querying the assistant about private or unauthorized
CRITERIA: documents receive a standard refusal, as the retrieval engine
blocks these snippets from being passed to the LLM context.

ID AIR - 005

TITLE: Prompt Injection and Jailbreak Mitigation

DESCRIPTION: The system must implement robust system prompts and input
sanitization to prevent users from executing prompt injection attacks
(e.g., instructing the model to ignore prior instructions, reveal
internal system prompts, or bypass read-only constraints).

PRIORITY: High/Essential Medium/Desired Low/Optional

ID AIR - 005

SOURCE OF THE REQUIREMENT

ACCEPTANCE Security testing verifies that malicious inputs attempting to
CRITERIA: override system instructions are neutralized, resulting in
standard, safe responses or explicit refusals from the assistant.

# 10. Use Cases

This document develops section 10 (Use Cases) of the Athenea Manager
SRS, based on the actors (section 2.4), functional requirements (section
6) and non-functional requirements (section 7) defined in the current
project documentation. Each use case includes actors, preconditions,
main flow, alternative flow(s), postconditions and the requirement from
which it is derived. ID Requirement Type Priority Related Use Title
(MoSCoW) Case(s) RF-001 Role-Based Functional MUST UC-001, Access UC-012
Control RF-002 Research Functional MUST UC-002 Project Registration
RF-003 Lifecycle Functional MUST UC-003 Managemen t and Approval
Workflow RF-004 Proposal Functional MUST UC-004 Versions and History
RF-005 Document-L Functional MUST UC-005 evel Visibility Configuratio n
RF-006 Milestones Functional COULD UC-006, and UC-007 Activities
Tracking

RF-007 Research Functional MUST UC-008 Products Registration RF-008
Dashboard Functional MUST UC-009 and Statistical Reports RF-009 AI
Assistant Functional MUST UC-010 for Queries (RAG) RF-010 Optional
Functional WON'T UC-011 Budget Managemen t RNF-001 Privacy and
Non-Functio MUST UC-002, LFPDPPP nal UC-005 Compliance RNF-002 AI
Non-Functio MUST UC-010 Modification nal Restriction (Read-Only) RNF-003
AI Response Non-Functio MUST UC-010 Traceability nal \### UC-001
---Role-Based Authentication and Access Control ID UC-001

NAME: Role-Based Authentication and Access Control ACTOR(S): Researcher,
Student, Coordinator, Committee, Administrator DESCRIPTION: Allows an
institutional user to authenticate on the platform and access only the
sections, processes, and documentation corresponding to their assigned
role.

PRECONDITION The user has an institutional account previously S:
registered in the system, with an already assigned role.

MAIN FLOW: 1. The user enters their institutional credentials. 2. The
system validates the credentials. 3. The system identifies the role
assigned to the user (not selectable by the user themselves). 4. The
system displays the menu, sections, and functionalities corresponding to
that role. ALTERNATIVE Invalid credentials: the system denies access and
FLOW(S): shows an error message. Account Lockout: If the user fails
authentication 5 consecutive times, the system temporarily locks the
account for 15 minutes (per RF-010)

ID UC-001

POSTCONDITIO The user is authenticated and their navigation is NS:
restricted exclusively to what is allowed by their role. PRIORITY High /
Essential Medium / Low / Optional Desirable RELATED RF-001, RF-010
REQUIREMENT(S ): \### UC-002 --- Research Project Registration ID UC-002
NAME: Research Project Registration ACTOR(S): Principal Investigator
DESCRIPTION: Allows the investigator to register a new research project,
capturing basic information and attaching the minimum required
documentation. PRECONDITION The user is authenticated with the
Researcher role. S: MAIN FLOW: 1. The researcher selects the "Register
Project" option. 2. Captures basic information: title, objectives,
participating researchers, dates, and funding. 3. Attaches the minimum
required documents (hypothesis, abstract, methodology, justification,
expected results). 4. The system validates that all mandatory fields and
documents are complete. 5. The system registers the project with the
"Proposed" status. ALTERNATIVE Limit Reached: If the PI already has 3
active projects FLOW(S): without an exemption, the system blocks the
registration attempt. Incomplete fields or documents: the system
prevents submission and points out pending fields/documents.
POSTCONDITIO The project is registered in "Proposed" status, available
NS: for review by the committee. PRIORITY High / Essential Medium / Low
/ Optional Desirable RELATED RF-002, BR-001, BR-002 REQUIREMENT(S ):
\### UC-003 --- Project Proposal Review and Evaluation ID UC-003 NAME:
Project Proposal Review and Evaluation ACTOR(S): Evaluation Committee,
Coordinator

DESCRIPTION: Allows the committee to review a proposal's documentation
and issue a formal decision (approval, rejection, or modification
request), recording the corresponding minute. PRECONDITION There is a
project in "Proposed" or "Under Review" S: status pending a decision.
The reviewing committee member must NOT have a family, civil, or marital
relationship with the PI (BR-011). MAIN FLOW: 1. The committee accesses
the list of projects pending review. 2. The system verifies no last-name
match exists between the reviewer and the project team (BR-011). 3. 3.
Selects a project and examines the attached documentation. 4. Records
the review minute with their observations. 5. Issues a decision:
Approved, Rejected, or Modification Required. 6. The system updates the
project status and logs the change along with the decision. ALTERNATIVE
Conflict of Interest Detected: If a last name match is FLOW(S): found,
the system triggers an automatic alert requiring manual Administrator
review before proceeding (BR-011). If the decision is "Modification
Required", the system notifies the researcher to upload a revised
version (see UC-004). POSTCONDITIO The project status is updated
(Approved, Rejected, or NS: pending modification) and the decision is
recorded in the history. PRIORITY High / Essential Medium / Low /
Optional Desirable RELATED RF-003, RF-019, BR-011 REQUIREMENT(S ): \###
UC-004 --- Upload Revised Proposal Version ID UC-004 NAME: Upload
Revised Proposal Version ACTOR(S): Principal Investigator DESCRIPTION:
Allows the researcher to upload a new version of the proposal after
receiving observations from the committee, keeping the complete history
of previous versions. PRECONDITION The project has a "Modification
Required" decision S: issued by the committee. MAIN FLOW: 1. The
researcher accesses the observed project. 2. Consults the comments and
the committee's minute. 3. Uploads the new version of the proposal. 4.
The system keeps the previous version and adds the

                 new one to the chronological history.
                 5. The project returns to the "Under Review" status.

ALTERNATIVE N/A FLOW(S): POSTCONDITIO A new record is generated in the
version history, NS: accessible along with previous committee comments.
PRIORITY High / Essential Medium / Low / Optional Desirable RELATED
RF-004 REQUIREMENT(S ): \### UC-005 --- Document Visibility
Configuration ID UC-005 NAME: Document Visibility Configuration
ACTOR(S): Principal Investigator DESCRIPTION: Allows the principal
investigator to define, at the document level, which files are visible
to administration and which remain private exclusively for their team.
PRECONDITION The researcher has at least one document uploaded S: within
the project. MAIN FLOW: 1. The researcher accesses the project's
documents section. 2. Selects a specific document. 3. Configures its
visibility as "Public" or "Private". 4. The system applies the
corresponding access restriction immediately. ALTERNATIVE An
administrative user attempts to access a document FLOW(S): marked as
"private": the system denies access. POSTCONDITIO The document
visibility is updated and the restriction NS: is effectively applied to
any subsequent queries. PRIORITY High / Essential Medium / Low /
Optional Desirable RELATED RF-005 REQUIREMENT(S ): \### UC-006 ---
Definition and Tracking of Milestones and Activities ID UC-006 NAME:
Definition and Tracking of Milestones and Activities ACTOR(S): Principal
Investigator, Student, Coordinator DESCRIPTION: Allows defining project
activities or milestones, tracking their progress, and enables the
coordinator to identify delayed projects.

PRECONDITION The project is in "Active" status. S: MAIN FLOW: 1. The
researcher defines an activity or milestone (e.g., literature review,
data collection). 2. Assigns the activity to a collaborator (researcher
or student). 3. The collaborator periodically updates the progress
status of the activity. 4. The coordinator views the consolidated
progress dashboard, which highlights delayed projects. ALTERNATIVE If an
activity exceeds its deadline without a progress FLOW(S): update, the
system marks it as "delayed" in the coordinator's view. POSTCONDITIO The
project activities' progress status is updated and NS: visible to the
coordinator. PRIORITY High / Essential Medium / Low / Optional Desirable
RELATED RF-006 REQUIREMENT(S ): \### UC-007 --- Student Progress
Evidence Upload ID UC-007 NAME: Student Progress Evidence Upload
ACTOR(S): Student DESCRIPTION: Allows a student to upload evidence of
their participation and progress in the activities assigned to them
within a project. PRECONDITION The student is assigned to at least one
activity of an S: active project. MAIN FLOW: 1. The student consults the
list of activities assigned to them. 2. Selects the corresponding
activity. 3. Uploads the progress evidence (document, report, or image).
4. The system records the evidence and notifies the responsible
researcher. ALTERNATIVE N/A FLOW(S): POSTCONDITIO The progress evidence
is associated with the activity NS: and is visible to the researcher and
the coordinator. PRIORITY High / Essential Medium / Low / Optional
Desirable RELATED RF-006 REQUIREMENT(S ): \### UC-008 --- Research
Products Registration ID UC-008 NAME: Research Products Registration
ACTOR(S): Principal Investigator DESCRIPTION: Allows linking research
products (articles, presentations, software, patents, theses) to the
corresponding project and participating researchers. PRECONDITION The
project exists and is in Active or Completed status. S: MAIN FLOW: 1.
The researcher accesses the "Research Products" section of the project.
2. Selects the type of product and uploads the corresponding
information/evidence. 3. Associates the product with the project and the
participating researchers. 4. The system saves the product in the
project profile. ALTERNATIVE N/A FLOW(S): POSTCONDITIO The research
product is visible in the project profile NS: and associated with its
authors. PRIORITY High / Essential Medium / Low / Optional Desirable
RELATED RF-007 REQUIREMENT(S ): \### UC-009 --- Dashboard and
Statistical Reports Generation ID UC-009 NAME: Dashboard and Statistical
Reports Generation ACTOR(S): Coordinator, Administrator DESCRIPTION:
Allows generating administrative dashboards with real-time metrics on
the number of projects, areas, status, budget, and researcher
productivity. PRECONDITION There are registered projects in the system.
S: MAIN FLOW: 1. The user accesses the dashboards/reports module. 2.
Selects the desired filters (area, department, status, date range). 3.
The system generates the dashboard or report with updated real-time
metrics. 4. The user views or exports the generated report. ALTERNATIVE
N/A FLOW(S): POSTCONDITIO The user obtains a consolidated view of the
NS: information without needing to manually collect it from multiple
sources. PRIORITY High / Essential Medium / Low / Optional Desirable

RELATED RF-008 REQUIREMENT(S ): \### UC-010 --- AI Assistant Inquiry
(RAG) ID UC-010 NAME: AI Assistant Inquiry (RAG) ACTOR(S): Researcher,
Student, Coordinator, Committee, Administrator; AI Assistant (system
actor) DESCRIPTION: Allows any authenticated user to ask natural
language questions about institutional procedures, regulations, or
project information, receiving a substantiated response traceable to its
source. PRECONDITION The user is authenticated on the platform. S: MAIN
FLOW: 1. The user asks a question in the assistant's chat. 2. The system
filters the query according to the user's role and permissions. 3. The
retrieval engine searches for relevant authorized document snippets. 4.
The authorized snippets are sent as context to the external LLM API. 5.
The assistant generates a natural language response citing the source
document. 6. The system displays the response to the user. ALTERNATIVE
If no relevant authorized snippet is retrieved, the FLOW(S): assistant
explicitly indicates that it lacks sufficient information, rather than
generating an unsubstantiated response. POSTCONDITIO The user receives
an informative response with NS: traceability to the source(s), without
the assistant modifying or approving project information (read-only
permissions). PRIORITY High / Essential Medium / Low / Optional
Desirable RELATED RF-009, RNF-002, RNF-003 REQUIREMENT(S ): \### UC-011
--- Optional Budget Management ID UC-011 NAME: Optional Budget
Management ACTOR(S): Principal Investigator DESCRIPTION: Allows the
research team to enable an optional module to record expenses and
compare them against the project's assigned budget.

PRECONDITION The project is active and the team decides to enable S: the
budget module. MAIN FLOW: 1. The researcher enables the budget module
for their project. 2. Records the initially assigned budget. 3. Records
expenses as they are made. 4. The system visually compares the
accumulated expenses against the assigned budget. ALTERNATIVE N/A
FLOW(S): POSTCONDITIO The team has a visual and updated comparison NS:
between actual expenses and the assigned budget. PRIORITY High /
Essential Medium / Low / Optional Desirable RELATED RF-010 REQUIREMENT(S
):

# 11. Requirements Prioritization

**MoSCoW classification.** Priority Requirements Justification MUST
RF-001, RF-002, RF-003, Core Lifecycle & Security: RF-004, RF-005,
RF-007, Access control, project RF-008, RF-010, RF-016, registration,
lifecycle, RF-018, RF-019, RF-020 document uploads, user authentication,
calls for RNF-001 to RNF-006, proposals, approvals, RNF-008 to RNF-010
archival. All security, performance, privacy AIR-001 to AIR-005
(LFPDPPP), and strict AI constraints are mandatory for release.

SHOULD RF-011, RF-012, RF-013, Important but RF-014, RF-017
Workaround-able: Team management, internal RNF-007 search, data
filtering, transactional notifications, and activity history. Browser
compatibility is highly desired but not a strict blocker for initial
deployment if it works in Chrome.

COULD RF-006, RF-015 Nice to Have: Milestone tracking (RF-006) and
Social Login/OAuth (RF-015) are great additions but the core system can
function without them in version 1.0.

WON'T RF-009 Out of Scope (For Now): Optional budget management (RF-009)
is explicitly marked as out-of-scope or purely optional for this
development phase.

# 12. Open Issues

**Questions that remain unresolved.** AI Provider and Budget Definition:
Although rate limits and read-only restrictions for the AI were defined,
the specific external provider (e.g., OpenAI, Anthropic, Azure) and the
exact maximum monthly budget before quota limits (Rate Limiting) are
enforced remain to be determined. Authorized Domains Management (Related
to BR-005 and RF-015): It was established that external users can access
the platform using authorized academic or corporate domains. It is
pending to define who (which role or department) will be responsible for
reviewing, approving, and maintaining the whitelist of these domains in
the system. Ethics Committee Role (Related to BR-006): The rule requires
uploading a valid document issued by the Ethics Committee (IRB) for
projects involving human subjects. It remains to be decided whether a
member of the Ethics Committee will have a specific user role within the
platform to verify the authenticity of said document, or if that
responsibility will fall solely on the project Coordinator.

# 13. Version history

Version Area Final status v1.0 Audited baseline Established as the
starting point for remediation. v1.1 Security and access control
Implemented and incorporated into the final SRS. v1.2 Business rules and
validation Implemented and aligned with Section 8 business rules. v1.3
Performance and scalability Implemented with measurable service-level
targets. v1.4 Project lifecycle and traceability Implemented with
explicit state, versioning, and audit controls. v1.5 UX and document
consistency Implemented; ambiguities and internal inconsistencies
resolved. v1.6 AI Assistant (AIR) Implemented with technical validation
and database access controls. v2.0 Final consolidated version Completed;
cross-review performed and document formally consolidated.
