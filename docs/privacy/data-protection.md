# Fathom — Personal Data and How It Is Protected

**Status:** Draft for HR review
**Prepared by:** Director, software organization
**Last updated:** 2026-10-30

## Purpose of This Document

Fathom is an internal planning tool for the software organization. It helps managers see who is working on what, plan the teams and people needed for upcoming work, and plan when to hire. This document describes the personal information about employees that Fathom's first release will hold, why it is needed, who can see it, and how it is protected. It is submitted for HR's review and approval before Fathom is used with real employee information.

Fathom is being developed using fictional data only. No real employee information will be entered until HR approves this document.

This document covers the first release only. Later releases are planned to add gender and planned reorganizations, to allow exports and saved snapshots of the plan, and to let users add their own fields, such as a skill. Each will be brought back to HR before it is added, and any new field that holds personal information will need HR's approval before it is used.

## Who Fathom Is For

Fathom is used by about 20–30 people in the software organization: Software Project Managers, Software Product Managers, Software Engineering Managers, the Director, and the VP. It is not available to other employees or to anyone outside the company.

## What Personal Information Fathom Holds

Fathom holds a small set of work-related details about each employee in the software organization. They are copied by hand from the HR system, which remains the official record.

| Information | Why it is needed | Sensitivity |
| --- | --- | --- |
| Preferred name | To identify people in plans | General |
| Site | To plan work across locations | General |
| Position (for example Software Engineer, Test Engineer) | To plan the mix of skills on each team | General |
| Team and manager | To see who reports to whom | General |
| Feature teams and feature leads (small groups formed to deliver related pieces of work, separate from reporting lines, and the person leading each) | To see who works together on what | General |
| Work assignments (which projects and features, and what share of each month) | To plan workload and spot overloaded people | General |
| Level (for example P1–P5, M1–M5, co-op) | To plan the experience mix on teams and the roles to hire | Restricted |
| Start date and end date | To avoid planning work for someone before they join or after they leave | Restricted |

### The Hiring Plan

Fathom also holds a hiring plan of roles to be filled, treated as Confidential because it can reveal plans before they are announced. Each planned role records details such as its position, level, team, manager, and target date, so it names the manager the new hire will report to. Once filled, it is linked to the person hired. A role planned to replace someone could reveal that they are leaving before it is announced.

It is proposed that all Fathom users see each planned role only as a placeholder in the plan, showing its position, team, the first month it can be assigned work, and its work assignments, while its other details stay Confidential.

### How the Information Is Used

Fathom's information is used only for planning. It is not used for performance evaluation or discipline.

### What Fathom Does Not Hold

Fathom does not hold salary or compensation, performance ratings or reviews, health or leave information, home addresses, personal phone numbers or email addresses, government identification numbers, or banking details.

### Information About Fathom's Users

Fathom also holds information about its own users: a user account for each person who uses Fathom, separate from company sign-in, holding their name and email address; a record of each signed-in session, with the network address and browser it started from, kept to investigate security problems; a history of who viewed or changed Restricted or Confidential information, and of every change to user accounts; and, on each record in the plan and on each employee's details, which user created it and last changed it, and when. A user sees only changes to information they are allowed to see. When a user leaves, their Fathom account must be disabled by hand.

## Who Can See and Change What

Access is controlled by roles. Each user is given one or more roles, and roles grant access by sensitivity level rather than screen by screen. The roles are proposed and will be agreed before Fathom goes live.

The table shows who can see each level under the proposed default roles for each job. What a user can see follows the roles they are actually given.

| Sensitivity | Who can see it by default |
| --- | --- |
| General | All Fathom users |
| Restricted | Software Engineering Managers, the Director, and the VP |
| Confidential | The Director and the VP |

Software Engineering Managers can see Restricted details for everyone, not only their own direct reports, because people move between managers over time and levels are already commonly visible across the company.

Under the proposed roles:

- **Employee details, teams, reporting lines, and the hiring plan** are maintained by the role that maintains workforce information, held initially only by the Director.
- **Work assignments** are maintained by Software Engineering Managers and the Director.
- **Feature teams** are maintained by Software Engineering Managers in the first release.
- **User accounts and roles** are managed by an administrator role that does not, by itself, give access to Restricted or Confidential information. An administrator could still reach such information by creating another account or resetting another user's password and signing in as them, so every such change is recorded in the access history. The Director holds this role at first, alongside the role that maintains workforce information, so for now the safeguards on granting access rely on the access history. A second person is planned to take on this role later.

## How the Information Is Protected

- **Kept inside the company:** Fathom runs on a company server in Canada, on the internal network. It is not reachable from the internet, and it does not send data to any outside service.
- **Encrypted connections:** Users connect to Fathom over an encrypted connection (HTTPS).
- **Individual accounts:** Each user signs in with their own account.
- **Access history:** Fathom records who viewed or changed Restricted or Confidential information, and every change to user accounts, without recording the information itself. No one can change or remove entries through Fathom; they are removed only as the agreed retention period requires. Administrators are proposed to be the ones who can view it.
- **Logs:** Personal information not needed for planning is kept out of Fathom's technical logs. The one exception is the network address of the computer each request comes from, which is kept to investigate security problems.
- **Encrypted backups:** Backups are made automatically, encrypted, and kept only in approved locations, which are still to be decided. The key needed to read them is held by someone other than the person who runs the backups, and restoring from backup is tested regularly.
- **Server and password management:** The server also hosts other applications. Fathom is planned to run in its own environment there, which only Fathom's named operators can use. Personal logins are never shared, and shared service passwords are limited to Fathom's named operators. Passwords are kept in a password manager or secret store, to be agreed with IT, and are changed when someone with access leaves. Anyone with full administrator access to the server could still reach Fathom's data; this risk is accepted and recorded, and who holds that access is reviewed with IT.
- **No real data in development:** Fathom's source code and test data never contain real employee information.

## Employees Who Leave

When someone leaves, their end date is recorded and their record is kept rather than deleted, so past plans stay accurate. How long details of employees who have left are kept is a question for HR below.

## Employees in Other Countries

The company has employees and managers in India, and may have employees in other countries. Their information is held on the same company server in Canada and protected in the same way. Managers in India who use Fathom will also see details of employees in Canada. Indian law, including India's Digital Personal Data Protection Act, 2023, may apply, and HR or Legal should confirm what it requires.

## Applicable Law

Our understanding, which is not legal advice, is that British Columbia's Personal Information Protection Act (PIPA) applies to this information as employee personal information, unless the company is federally regulated. Under PIPA, employers can generally collect and use employee information that is reasonably needed to manage employment without consent, as long as employees are told beforehand and given the purposes. Employees can ask to see or correct their information. Information used to make a decision that directly affects someone must be kept for at least one year after that decision, and then destroyed or anonymized once it is no longer needed.

## Questions for HR

1. **Approval:** Is the information listed above acceptable to hold for planning purposes?
1. **Employee notice:** How should employees be told that Fathom holds this information, and for what purposes?
1. **Access and correction:** How should employees ask to see or correct their information? Since the HR system is the official record, corrections would normally be made there and copied into Fathom.
1. **Retention:** How long should details of employees who have left be kept before they are removed? Is Fathom's information ever used to make a decision that directly affects someone?
1. **Access history:** Who should be able to view the history of who viewed or changed information, and how long should it be kept? How long should records of signed-in sessions, with their network addresses and browsers, be kept?
1. **Other countries:** What does Indian law, or the law of any other country where we have employees, require for this information, including managers in India seeing details of employees in Canada?
1. **Server location:** Are there any concerns about holding information about employees outside Canada on a server in Canada?
1. **Contacts and incidents:** Who should employees contact with questions, and what should happen if information is exposed?
