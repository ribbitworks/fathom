# Fathom — Personal Data and How It Is Protected

**Status:** Draft for HR review
**Prepared by:** Director, software organization
**Last updated:** 2026-11-06

## Purpose of This Document

Fathom is an internal planning tool for the software organization. It helps managers see who is working on what, plan the teams and people needed for upcoming work, and plan when to hire. This document describes the personal information about employees that Fathom's first release will hold, why it is needed, who can see it, and how it is protected. It is submitted for HR's review and approval before Fathom is used with real employee information.

Fathom is being developed using fictional data only. No real employee information will be entered until HR approves this document.

This document covers the first release only. Later releases are planned to add gender and planned reorganizations, to allow exports and saved snapshots of the plan, to let users add other kinds of fields of their own, such as a skill, and possibly to record each employee's work email address so managers can see the details of the people who report to them. Each of these will be brought back to HR before it is added, and any new field that holds personal information will need HR's approval before it is used.

## Who Fathom Is For

Fathom is used by about 20–30 people in the software organization at first: Project Managers, Product Managers, Engineering Managers, Feature Leads, who may be engineers, the Engineering Director, an Engineering Operations Manager who maintains workforce information, and the Executive. Team members, such as engineers, may be given accounts later, and would then see the plan, including everyone's work assignments, but not the other employee details, such as site and level. It is not available to employees outside the software organization, or to anyone outside the company.

## What Personal Information Fathom Holds

Fathom holds a small set of work-related details about each employee in the software organization. They are copied by hand from the company's HR system, which remains the official record. They can also be imported from a CSV or TSV file, which Fathom reads in the user's browser and does not keep.

Each employee's preferred name, Employee ID, position, start and end dates, and whether they manage people are built in, with positions chosen from a list that role keeps. Their site, level, and role on the team are columns the role that maintains workforce information adds, each choosing from a list that role keeps, such as a list of sites. Each list is marked with who may see what is chosen from it, so a column can be General, Restricted, or Confidential. A column can instead hold a web link for each employee, such as the address of a page about them, marked the same way. That marking can later be lowered, which shows the details already chosen to more people; such a change is recorded and can be undone. Any further column that holds personal information is brought to HR for approval before it is used.

| Information | Why it is needed | Sensitivity |
| --- | --- | --- |
| Preferred name | To identify people in plans | General |
| Employee ID (the ID the company uses for each employee, such as their number in the HR system) | To tell apart people with the same name, and to match records to the HR system | General |
| Site | To plan work across locations | General |
| Position (for example Software Engineer, Test Engineer) | To plan the mix of skills on each team | General, unless the positions list is marked otherwise |
| Team and manager, and whether the employee manages people | To see who reports to whom, and to offer only those flagged as managers as anyone's manager | General |
| Feature teams and feature leads (small groups formed to deliver related pieces of work, separate from reporting lines, and the person leading each) | To see who works together on what | General |
| Work assignments (which projects and features, and what share of each month) | To plan workload and spot overloaded people | General |
| Level (for example P1–P5, M1–M5, co-op) | To plan the experience mix on teams and the roles to hire | General |
| Role on the team (for example Team Lead, Design Authority) | To see who leads and who holds design responsibility on each team | General |
| Start date and end date | To avoid planning work for someone before they join or after they leave | Restricted |
| Past managers, and the date each change of manager took effect | To count each manager's team for past months | Restricted |
| Past feature teams, and the dates each person joins and leaves feature teams | To count each feature team's capacity for past months, kept Restricted because a person's first feature team usually starts on their start date | Restricted |

### The Hiring Plan

Fathom also holds a hiring plan of roles to be filled, treated as Confidential because it can reveal plans before they are announced. Each planned role records its requisition, or a temporary ID until it has one, its position, manager, target date, and state, such as whether its headcount is approved, and details such as its site and level, so it names the manager the new hire will report to. Once filled, it is linked to the person hired, and the person takes its place, who may be an existing employee moving to the role. A role planned to replace someone could reveal that they are leaving before it is announced.

Users who may see employee details see each planned role, until it is filled and its new employee has started, only as a placeholder, a row beside employees: its requisition, position, state, manager, the month it is expected to start, and details it shares with employees, such as site and level. Its state says whether its headcount is approved; like its position, it is General unless its list is marked otherwise. Every Fathom user sees it in the plan by its position, requisition, and that month, with its work assignments; if the positions list is marked as more sensitive, those who may not see it see the requisition without the position. Its exact target date and other details stay Confidential, so the placeholder does not say whether it replaces someone. A new employee added before their start date is seen only by those who may see start dates; everyone else keeps seeing the filled role's placeholder until they start.

### How the Information Is Used

Fathom's information is used only for planning. It is not used for performance evaluation or discipline.

### What Fathom Does Not Hold

Fathom does not hold salary or compensation, performance ratings or reviews, health or leave information, home addresses, personal phone numbers or email addresses, government identification numbers, or banking details.

### Information About Fathom's Users

Fathom also holds information about its own users: a user account for each person who uses Fathom, separate from company sign-in, holding their name and email address; a record of each signed-in session, with the network address and browser it started from, kept to investigate security problems; a history of who viewed or changed Restricted or Confidential information, recording each user's viewing at most once a day, and of every change to user accounts; and a history of every change to the plan and to employees' details, with the old and new values, which user made it, and when, so changes can be checked and undone. Like the access history, it can only be added to, apart from marking a user's changes published. A user sees only changes to information they are allowed to see, and the history keeps earlier values, such as a past end date, for as long as the agreed retention period allows. When a user leaves, their Fathom account must be disabled by hand.

## Who Can See and Change What

Access is controlled by roles. Each user is given exactly one role, and roles grant access by sensitivity level rather than screen by screen. Fathom starts with one role for each job; roles can be changed, and new ones made, in Fathom. The roles are proposed and will be agreed before Fathom goes live.

The table shows who can see each level under the proposed starting role for each job. What a user can see follows the role they are actually given.

| Sensitivity | Who can see it by default |
| --- | --- |
| General | Engineering Managers, the Engineering Director, the Engineering Operations Manager, and the Executive; work assignments are seen by all Fathom users |
| Restricted | Engineering Managers, the Engineering Director, the Engineering Operations Manager, and the Executive |
| Confidential | The Engineering Director, the Engineering Operations Manager, and the Executive |

Engineering Managers can see Restricted details for everyone, not only their own direct reports, because people move between managers over time.

Under the proposed roles:

- **Employee details, teams, reporting lines, and the hiring plan** are maintained by the role that maintains workforce information, held by the Engineering Operations Manager.
- **Work assignments** are maintained by Engineering Managers and the Engineering Director.
- **Changes waiting for approval:** Changes to employee details, teams' names, reporting lines, and the hiring plan wait for approval, by someone whose role lets them see that information, such as the Engineering Director, before they take effect. Until then, they are seen by everyone who may see that information. A rejected change is kept, with the approver's reason, until it is changed or discarded. A team's colour on the org chart is not a detail of anyone, so it changes at once, without approval.
- **Feature teams** are proposed by Engineering Managers and approved by those who approve plan changes, such as the Engineering Director.
- **User accounts and roles** are managed by an administrator role that does not, by itself, give access to Restricted or Confidential information. Roles can be changed in Fathom, by whoever may edit them, held by the administrator role at first. An administrator, or anyone whose role lets them manage accounts, could still reach such information by giving their own account another role, by widening the role they hold, or by creating another account or resetting another user's password and signing in as them, so every such change is recorded in the access history. At first, only the Fathom Administrator account, made when Fathom is installed, holds this role, so the safeguards on granting access rely on the access history. A person given this role later can take over from it. A change granting Confidential data takes effect at once, without anyone else confirming it, until HR asks for such a check; the access history marks every account created, every change to an account's role, and every change to a role as worth checking.

## How the Information Is Protected

- **Kept inside the company:** Fathom runs on a company server in Canada, on the internal network. It is not reachable from the internet, and it does not send data to any outside service.
- **Encrypted connections:** Users connect to Fathom over an encrypted connection (HTTPS).
- **Individual accounts:** Each user signs in with their own account.
- **Change history:** Fathom keeps every change to employee information, with its earlier and later values, who made it, and when. Users see only changes to information their role lets them see, and seeing changes to Restricted or Confidential details is recorded in the access history. A change someone has not yet published is seen only by them, in tables and in the change history, until they publish it; others see only that the record is being changed, and by whom.
- **Access history:** Fathom records who viewed or changed Restricted or Confidential information, and every change to user accounts and to roles, without recording the information itself. It also records every change to Fathom's settings, such as its time zone, with the setting before and after. No one can change or remove entries through Fathom; they are removed only as the agreed retention period requires. Administrators are proposed to be the ones who can view it.
- **Logs:** Personal information not needed for planning is kept out of Fathom's technical logs. The one exception is the network address of the computer each request comes from, which is kept to investigate security problems. What a user searches for in a table or a history, such as a name, is kept in the page's address, so it stays in their browser's history and in any link they share, but not in Fathom's logs. A view a user saves, with what they searched for, is shared with everyone who may see the table, except a view filtering on, or counting people by, information someone may not see, which is kept from them.
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
1. **Retention:** How long should details of employees who have left be kept before they are removed, how long should the history of changes, with its earlier values, be kept, and how long may a rejected change wait to be changed or discarded? Is Fathom's information ever used to make a decision that directly affects someone?
1. **Access history:** Who should be able to view the history of who viewed or changed information, and how long should it be kept? How long should records of signed-in sessions, with their network addresses and browsers, be kept?
1. **Other countries:** What does Indian law, or the law of any other country where we have employees, require for this information, including managers in India seeing details of employees in Canada?
1. **Server location:** Are there any concerns about holding information about employees outside Canada on a server in Canada?
1. **Contacts and incidents:** Who should employees contact with questions, and what should happen if information is exposed?
