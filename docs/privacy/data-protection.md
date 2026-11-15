# Fathom: Personal Data and How It Is Protected

**Status:** Draft for HR review
**Prepared by:** Director, software organization
**Last updated:** 2026-11-13

## Purpose of This Document

Fathom is an internal planning tool for the software organization. It helps managers see who is working on what, plan the teams and people needed for upcoming work, and plan when to hire. This document describes the personal information about employees that Fathom's first release will hold, why it is needed, who can see it, and how it is protected. It is submitted for HR's review and approval before Fathom is used with real employee information.

Fathom is being developed using fictional data only. No real employee information will be entered until HR approves this document.

This document covers the first release only. Later releases are planned to add the [planned classes](#planned-classes), to allow saved snapshots of the plan, to let users add other kinds of fields of their own, such as a skill, and possibly to record each employee's work email address so managers can see the details of the people who report to them. Each of these will be brought back to HR before it is added, and any new field that holds personal information will need HR's approval before it is used.

## Who Fathom Is For

Fathom is used by about 20 to 30 people in the software organization at first: managers and leads, directors, an Engineering Operations Manager who maintains workforce information, and the Executive, as the [Product Brief](../product/brief.md#users) sets out. Team members, such as engineers, may be given accounts later; what they would see is set out in [Roles](../product/roles.md#starting-roles). It is not available to employees outside the software organization, or to anyone outside the company.

## What Personal Information Fathom Holds

Fathom holds a small set of work-related details about each employee in the software organization. They are copied by hand from the company's HR system, which remains the official record. From v1.1, they can also be imported from a CSV or TSV file, which Fathom reads in the user's browser and does not keep.

Each employee's preferred name, Employee ID, position, start and end dates, and whether they manage people are built in, with positions chosen from a list that role keeps. Their site, level, and role on the team are columns the role that maintains workforce information adds, each choosing from a list that role keeps, such as a list of sites. Each list has a data class, General, Personal, or Confidential, which decides who sees what is chosen from it, as [Data Classes](#data-classes) sets out. A column can instead hold a web link for each employee, such as the address of a page about them, or a note written about them, of up to 10,000 characters of text, or a number, each with a data class of its own. Notes are written freely, so what they hold depends on those who write them; like any other change, a note is a draft until it is approved. Any further column that holds personal information is brought to HR for approval before it is used.

| Information | Why it is needed | Starting class |
| --- | --- | --- |
| Preferred name | To identify people in plans | General |
| Employee ID (the ID the company uses for each employee, such as their number in the HR system) | To tell apart people with the same name, and to match records to the HR system | General |
| Site | To plan work across locations | General |
| Position (for example Software Engineer, Test Engineer) | To plan the mix of skills on each team | General, unless the positions list's class is changed |
| Team and manager, and whether the employee manages people | To see who reports to whom, and to offer only those flagged as managers as anyone's manager | General |
| Feature teams and feature leads (small groups formed to deliver related pieces of work, separate from reporting lines, and the person leading each) | To see who works together on what | General |
| Work assignments (which projects and features, and what share of each month) | To plan workload and spot overloaded people | General |
| Level (for example P1 to P5, M1 to M5, co-op) | To plan the experience mix on teams and the roles to hire | General |
| Role on the team (for example Team Lead, Design Authority) | To see who leads and who holds design responsibility on each team | General |
| Start date and end date | To avoid planning work for someone before they join or after they leave | Personal |
| Whether the employee has left, shown as their state, such as Hired or Left, in the organization's own words | To leave people who have left out of plans, filters, and counts | General, unless the hiring states list's class is changed; people who have left are listed only to those who see their end date, which is Personal |
| Past managers, and the date each change of manager took effect | To count each manager's team for past months | Personal |
| Which feature teams each person is on, and who leads them, month by month, past and planned | To see who works together when, and to plan ahead | General today; month by month, and on other dates, shown only to those who see Personal information, since teams over time tell of start dates |
| The exact dates each person joins and leaves feature teams, and each feature lead changes | To count each feature team's capacity for past months, kept Personal because a person's first feature team usually starts on their start date | Personal |

### The Hiring Plan

Fathom also holds a hiring plan of roles to be filled, kept in the Confidential class because it can reveal plans before they are announced. Seeing it beyond its placeholders is a permission of its own, apart from other Confidential information, and also needs sight of the hiring plan's class: Confidential, or the class the organization moves it to. Each planned role records an optional name, any label the organization gives it, its requisition, or a temporary ID until it has one, its position, manager, target date, and state, such as whether its headcount is approved, and details such as its site and level, so it names the manager the new hire will report to. Once filled, it is linked to the person hired, and the person takes its place, who may be an existing employee moving to the role. A role planned to replace someone could reveal that they are leaving before it is announced.

Users who may see employee details see each planned role, until it is filled and its new employee has started, only as a placeholder, a row beside employees: its name, requisition, position, state, manager, the month it is expected to start, and details it shares with employees, such as site and level. Its state says whether its headcount is approved; like its position, it is General unless its list is marked otherwise. Its name is General, like an employee's, so a name that identifies someone, such as one naming the person a role replaces, is seen by everyone who may see employee details or the org chart. Every Fathom user sees it in the plan by its position, requisition, and that month, with its work assignments; if the positions list is moved to a class beyond General, those who may not see that class see the requisition without the position. Everyone who may see the org chart sees it there too, under its manager, by its name, or by its position and requisition, with the month it is expected, and a planned role marked as a manager is shown heading the planned roles that report to it. Its exact target date and other details are seen only by those who may see the hiring plan, so the placeholder does not say whether it replaces someone; its details such as site and level keep their own class even then. A new employee added before their start date is seen only by those who may see start dates; everyone else keeps seeing the filled role's placeholder until they start.

### How the Information Is Used

Fathom's information is used only for planning. It is not used for performance evaluation or discipline.

### What Fathom Does Not Hold

Fathom does not hold salary or compensation, performance ratings or reviews, health or leave information, home addresses, personal phone numbers or email addresses, government identification numbers, or banking details. The [planned classes](#planned-classes) would let an organization add a column for such details later; any such column is brought to HR for approval before it is used.

### Information About Fathom's Users

Fathom also holds information about its own users: a user account for each person who uses Fathom, separate from company sign-in, holding their name and email address; a record of each signed-in session, with the network address and browser it started from, kept to investigate security problems; a history of who viewed or changed Personal or Confidential information, recording each user's viewing at most once a day, of every change to user accounts, and of each sign-in and change of role, with the role used; and a history of every change to the plan and to employees' details, with the old and new values, which user made it, and when, so changes can be checked and undone. Like the access history, it can only be added to, apart from marking a user's changes published. A user sees only changes to information they are allowed to see, and the history keeps earlier values, such as a past end date, for as long as the agreed retention period allows. When a user leaves, their Fathom account must be disabled by hand.

## Who Can See and Change What

Access is controlled by roles. Each user is given one or more roles and acts as one at a time, with only that role's access. A role grants access to areas, such as the plan or people, and to classes of data within them, rather than screen by screen. Fathom starts with one role for each job; roles can be changed, and new ones made, in Fathom. The roles are proposed and will be agreed before Fathom goes live.

Which roles see each class, the hiring plan beyond its placeholders, work assignments, and the org chart is set out in [Roles](../product/roles.md#what-each-role-can-do). The org chart shows each employee's General details, such as name, position, team, and manager, to every role that sees people, which is every starting role but the Administrator.

### Data Classes

Every detail Fathom keeps, every column added to employees' details, and every list belongs to one data class, which decides who sees it:

- **General:** seen by everyone whose role reaches the page that holds it.
- **Personal:** information private to a person, which stays so, such as start and end dates and past managers. Seen only by roles that see Personal data.
- **Confidential:** information about the organization not yet announced, such as the hiring plan and planned reorganizations. It runs out: a planned reorganization becomes the org chart on its date, and a planned role becomes a person once filled, much as a person's departure is shown once they have left. Seen only by roles that see Confidential data.

Of the starting roles, Project Managers, Engineering Managers, the Engineering Director, the Workforce Administrator, and the Executive see Personal and Confidential data; Team Members, Product Managers, Feature Leads, and the Administrator see neither.

A page, view, or column is shown only to roles that see every class of data it needs, never with some of its data hidden or blurred, and one a role would find empty is left out altogether. People who have not started yet are listed only to roles that see start dates' class, and people who have left only to roles that see end dates' class. The Roles page lists, for each role, each page and view it does not get, with the permissions and classes it needs, such as "Org chart on other dates: needs Personal", naming the class but never the details in it, since each organization decides what its classes hold.

The table above gives each detail's starting class; new lists and columns start General. Start and end dates, past managers, the dates people join and leave feature teams, planned reorganizations, the hiring plan, and any list or added column can be moved to another class, but only by someone whose role may classify data, and only between classes that role sees. Of the starting roles, the Engineering Director and the Workforce Administrator may. A move takes effect at once on every page, is recorded in the access history and marked for a second look, and is reversed by moving it back. A new list or column given a class before it is approved is recorded the same way once it is approved. Names, Employee IDs, current managers, teams, feature teams, and work assignments stay General, since every page finds its rows by them.

### Planned Classes

Two more classes are planned and not yet built: Highly Personal, for details such as salary or performance reviews, and Highly Confidential. Each will have its own permission to see and change it, and seeing Highly Personal data will also need Personal, and Highly Confidential data Confidential. No built-in detail will start in either; they are for the organization's own columns and lists. How an organization uses the classes, and tells those who need to know, is up to it.

### Approvals and Administration

Under the proposed roles, [Roles](../product/roles.md#what-each-role-can-do) sets out who maintains employee details, teams, reporting lines, the hiring plan, work assignments, and feature teams, and who approves them:

- **Changes waiting for approval:** Changes to employee details, teams' names, reporting lines, and the hiring plan wait for approval, by someone whose role lets them approve changes of that kind and see that information, before they take effect. The approver must be someone other than whoever changed the draft, unless their role allows approving their own. Until then, they are seen by everyone who may see that information. A rejected change is kept, with the approver's reason, until it is changed or discarded. A team's colour on the org chart is not a detail of anyone, so it changes at once, without approval.
- **User accounts and roles** are managed by an administrator role that does not, by itself, give access to Personal or Confidential information. Roles can be changed in Fathom, by whoever may edit them, held as [Roles](../product/roles.md#what-each-role-can-do) sets out. From Fathom's first deployment, an update to Fathom never changes what an organization's existing roles grant: an improved starting role reaches it only when someone who may edit roles chooses Restore template on that role and saves it, a change the access history records like any other. An update may add a new starting role, which grants nothing until it is given to an account. Some roles see accounts, roles, and settings, read only, without changing them. An administrator, or anyone whose role lets them manage accounts, could still reach such information by giving their own account another role, by widening the role they hold, or by creating another account or resetting another user's password and signing in as them, so every such change is recorded in the access history. At first, only the Fathom Administrator account, made when Fathom is installed, holds this role, so the safeguards on granting access rely on the access history. A person given this role later can take over from it. A change granting Confidential data takes effect at once, without anyone else confirming it, until HR asks for such a check; the access history marks every account created, every change to an account's roles, and every change to a role as worth checking.

## How the Information Is Protected

- **Kept inside the company:** Fathom runs on a company server, on the internal network. It is not reachable from the internet, and it does not send data to any outside service.
- **Encrypted connections:** Users connect to Fathom over an encrypted connection (HTTPS).
- **Individual accounts:** Each user signs in with their own account.
- **Change history:** Fathom keeps every change to employee information, with its earlier and later values, who made it, and when. Users see only changes to information their role lets them see, and seeing changes to Personal or Confidential details is recorded in the access history. A change someone has not yet published is seen only by them, in tables and in the change history, until they publish it; others see only that the record is being changed, and by whom.
- **Access history:** Fathom records who viewed or changed Personal or Confidential information, and every change to user accounts and to roles, without recording the information itself. It also records every change to Fathom's settings, such as its time zone, with the setting before and after. No one can change or remove entries through Fathom; they are removed only as the agreed retention period requires. Who can view it is set out in [Roles](../product/roles.md#what-each-role-can-do).
- **Exports:** A user may save what a table shows, such as People, as a spreadsheet file holding only what their role lets them see. Before a file holding Personal or Confidential information is saved, Fathom asks them to confirm, naming what it holds, and records the export in the access history, naming the columns but not their values. The file then leaves Fathom, so it is kept and shared under the organization's own rules for such files.
- **Logs:** Employee information not needed for planning is kept out of Fathom's technical logs. The one exception is the network address of the computer each request comes from, which is kept to investigate security problems. What a user searches for in a table or a history, such as a name, is kept in the page's address, so it stays in their browser's history and in any link they share, but not in Fathom's logs. A view a user saves, with what they searched for, is shared with everyone who may see the table, except a view filtering on, or counting people by, information someone may not see, which is kept from them.
- **Encrypted backups:** Backups are made automatically, encrypted, and kept only in approved locations, which are still to be decided. The key needed to read them is held by someone other than the person who runs the backups, and restoring from backup is tested regularly.
- **Server and password management:** The server also hosts other applications. Fathom is planned to run in its own environment there, which only Fathom's named operators can use. Personal logins are never shared, and shared service passwords are limited to Fathom's named operators. Passwords are kept in a password manager or secret store, to be agreed with IT, and are changed when someone with access leaves. Anyone with full administrator access to the server could still reach Fathom's data; this risk is accepted and recorded, and who holds that access is reviewed with IT.
- **No real data in development:** Fathom's source code and test data never contain real employee information.

## Employees Who Leave

When someone leaves, their end date is recorded and their record is kept rather than deleted, so past plans stay accurate. How long details of employees who have left are kept is a question for HR below.

## Employees in Other Countries

The company may have employees and managers in more than one country. Their information is held on the same company server and protected in the same way, so managers in one country who use Fathom may see details of employees in another. The law of each country where employees work may apply, and HR or Legal should confirm what it requires.

## Applicable Law

Our understanding, which is not legal advice, is that the privacy law where the company is based applies to this information as employee personal information. Such laws commonly let employers collect and use employee information that is reasonably needed to manage employment without consent, as long as employees are told beforehand and given the purposes. Employees can commonly ask to see or correct their information. Information used to make a decision that directly affects someone may have to be kept for a set time after that decision, and then destroyed or anonymized once it is no longer needed. HR or Legal should confirm which laws apply and what they require.

## Questions for HR

1. **Approval:** Is the information listed above acceptable to hold for planning purposes?
1. **Employee notice:** How should employees be told that Fathom holds this information, and for what purposes?
1. **Access and correction:** How should employees ask to see or correct their information? Since the HR system is the official record, corrections would normally be made there and copied into Fathom.
1. **Retention:** How long should details of employees who have left be kept before they are removed, how long should the history of changes, with its earlier values, be kept, and how long may a rejected change wait to be changed or discarded? Is Fathom's information ever used to make a decision that directly affects someone?
1. **Access history:** Who should be able to view the history of who viewed or changed information, and how long should it be kept? How long should records of signed-in sessions, with their network addresses and browsers, be kept?
1. **Other countries:** What does the law of each country where we have employees require for this information, including managers in one country seeing details of employees in another?
1. **Server location:** Are there any concerns about holding information about employees in one country on a server in another?
1. **Contacts and incidents:** Who should employees contact with questions, and what should happen if information is exposed?
