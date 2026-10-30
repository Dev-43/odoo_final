# PeoplePay360 — Demo Video Script

7-10 minute walkthrough covering RBAC (all 5 roles), both PS-required demo scenarios,
the live dashboard, and the extras (Mailpit email delivery, audit/error logs).
Voiceover script is formatted for ElevenLabs generation.

---

## Before recording — setup checklist

```bash
cd server
npm install
npx prisma db push
npx prisma db seed
```

**Do not skip the reseed.** Two things only take effect after a fresh seed: the
corrected leave-type flags that make paid leave count toward payroll, and cleaning
out junk test accounts (`pending-test-...@test.com`, `escalation-test-...@test.com`)
left in the database by earlier automated test runs — the seed script wipes all
users before recreating them.

Then, in separate terminals:

```bash
# Terminal 1 — backend (API + payslip-send worker run in the same process)
cd server && npm run dev
```

```bash
# Terminal 2 — frontend
cd payroll-dashboard && npm run dev
```

```bash
# Terminal 3 — Mailpit (local SMTP inbox)
mailpit
```

Make sure Postgres and Redis are already running before this.

- App: `http://localhost:5173`
- Mailpit inbox: `http://localhost:8025`

**Verified working credentials:**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@peoplepay360.com` | `Admin@123` |
| HR Payroll Manager | `payroll.manager@peoplepay360.com` | `Manager@123` |
| HR Payroll User | `payroll.user@peoplepay360.com` | `User@123` |
| HR Manager | `hr.manager1@peoplepay360.com` | `Hr@123` |
| Employee | `emp1@peoplepay360.com` | `Emp@123` |

Open 2-3 browser windows pre-logged-in as different roles (or separate profiles) so
role-switching on camera is instant, not typed live.

**Important — payrun period for the demo:** the seed data already includes 3 historical
payruns covering nearly every employee: June 2026 (paid), July 2026 (paid), and August
2026 (validated). When you create your live demo payrun in clip 9, pick **September
2026 or later**. Any period overlapping June-August will correctly get blocked at
validation with a "duplicate payslip" error, since those employees are already paid
for that period — that's the system working as intended, not a bug, but it'll derail
your recording if you hit it live.

---

## SHOW (screen actions)

1. Login screen, app title visible.
2. Log in as Employee (`emp1@peoplepay360.com`) — show My Profile / My Attendance / My Time Off / My Payslips nav only.
3. Log out, log in as HR Manager (`hr.manager1@peoplepay360.com`) — show Employees / Contracts / Attendance / Schedules / Time Off nav, no Payroll menu.
4. Log out, log in as HR Payroll User (`payroll.user@peoplepay360.com`) — show same HR nav plus Payruns/Payslips and a greyed/read-only Salary Structures page.
5. Log out, log in as HR Payroll Manager (`payroll.manager@peoplepay360.com`) — show full Payroll menu including Salary Structures/Rules editable.
6. Log out, log in as Admin (`admin@peoplepay360.com`) — open User Management, show a pending account, click Approve.
7. Open an Employee record — department, manager, schedule, status, smart-button counts.
8. Open that employee's Contracts tab — point at the active contract highlighted.
9. Go to Payroll → New Payrun — Step 1: pick Salary Structure + Period. **Use September 2026 or later** (the seed data already includes paid/validated payruns for June, July, and August 2026 — picking one of those periods will trigger the duplicate-payslip block during validation). Click Continue.
10. Step 2: eligible employee list appears, select employees, click Create Payrun.
11. Open the created Payrun, click Compute.
12. Open one payslip, show the Basic/Allowance/Deduction/Gross/Net line breakdown.
13. Click Validate on the payrun.
14. Click Mark Paid.
15. Click Send Payslips.
16. Switch browser tab to `localhost:8025` (Mailpit), open the newest email, show the PDF attachment opened.
17. Go to Time Off → Allocations tab — show allocated/taken/remaining for an employee.
18. Go to Time Off → Requests tab, find a Pending request, click Approve.
19. Flip back to Allocations tab, show the balance number now reduced.
20. Go to Reports/Dashboard — show KPI cards, Salary Cost by Department chart, Monthly Trend chart.
21. Change the Period filter, then the Department filter — show the numbers and charts update live.
22. As Admin, open Audit Log — scroll through a few entries (approve/validate/create actions with user + timestamp).
23. Open Error Log briefly.
24. Back to the app home/dashboard screen, hold for outro.

---

## VOICEOVER SCRIPT (ElevenLabs-ready)

Generate each clip as its own separate audio file rather than one giant block — it's
easier to sync to the screen action, and easier to redo a single line if one take
comes out wrong.

`<break time="x.xs" />` tags work reliably with ElevenLabs' standard models but can
vary slightly by voice. Punctuation (commas, ellipses, periods) always works as a
pacing fallback regardless of model, so both are used together below.

### CLIP 1
```
This is PeoplePay360<break time="0.4s" /> — an integrated HR and payroll platform.<break time="0.6s" /> Employees sit at the center of the system, with contracts, work schedules, attendance, and time off all feeding into payroll<break time="0.3s" /> — and payroll itself is driven by configurable salary rules, not hardcoded numbers.<break time="0.6s" /> The platform supports five distinct user roles, each with its own permissions, enforced not just in the interface, but on the backend as well.
```
*(Leave ~1s before starting — let the login screen sit on frame first.)*

### CLIP 2
```
Let's start with the most restricted role<break time="0.3s" /> — a regular Employee.<break time="0.5s" /> They only see their own profile, their own attendance, their own time off, and their own payslips.<break time="0.4s" /> Nothing else in the system is visible to them.
```

### CLIP 3
```
Now let's log in as an HR Manager.<break time="0.5s" /> This role has full access to Employees, Contracts, Attendance, Schedules, and Time Off<break time="0.3s" /> — but notice, there's no Payroll menu here at all.<break time="0.4s" /> HR Managers handle people and processes, not pay.
```

### CLIP 4
```
An HR Payroll User has everything an HR Manager has, plus the ability to create and manage payruns and payslips.<break time="0.5s" /> But look closely at Salary Structures<break time="0.3s" /> — this role can only view them, not edit them.<break time="0.4s" /> Editing pay structures is reserved for a higher role.
```

### CLIP 5
```
That higher role is the HR Payroll Manager,<break time="0.3s" /> who has full control over payruns, payslips, and the salary structures and rules that drive every payslip calculation.
```

### CLIP 6
```
And finally, the Admin.<break time="0.5s" /> Beyond full system access, Admins manage user accounts<break time="0.3s" /> — including approving new registrations.<break time="0.5s" /> Here's a pending account waiting for approval.<break time="0.4s" /> One click,<break time="0.3s" /> and that user can now log in with the role we've assigned them.
```

### CLIP 7
```
Let's walk through an actual payroll cycle.<break time="0.5s" /> Here's an employee record<break time="0.3s" /> — their department, manager, work schedule, and status, along with quick-access counts for their contracts, attendance, and time off.
```

### CLIP 8
```
Opening their contract history<break time="0.3s" /> — you can see the active contract highlighted.<break time="0.5s" /> The system enforces that an employee can never have two active contracts at once, and payroll always uses whichever contract was actually in effect for the period being paid.
```

### CLIP 9
```
Now let's run payroll.<break time="0.5s" /> Creating a new payrun opens a wizard<break time="0.3s" /> — first step is choosing the salary structure and pay period.<break time="0.5s" /> Clicking Continue here does not create anything yet<break time="0.3s" /> — it's just scoping the run.
```

### CLIP 10
```
The second step shows only the employees eligible for this period.<break time="0.4s" /> We select who to include,<break time="0.3s" /> and only now does the actual payrun get created.
```

### CLIP 11
```
With the payrun created, we click Compute<break time="0.3s" /> — this is where the salary rule engine actually runs the numbers for every selected employee.
```

### CLIP 12
```
Opening one payslip, you can see the full breakdown<break time="0.3s" /> — basic pay, allowances, deductions, gross, and net salary<break time="0.4s" /> — all calculated live from that employee's contract and salary structure, not hardcoded.
```

### CLIP 13
```
Before this can be finalized, we validate it.<break time="0.5s" /> Validation checks for problems<break time="0.3s" /> — missing bank details, or an employee who's already been paid for an overlapping period somewhere else<break time="0.3s" /> — and blocks finalization until those are resolved.
```

### CLIP 14
```
Once validated, we mark the payrun as paid.
```

### CLIP 15
```
And finally, we send payslips<break time="0.3s" /> — this triggers a real bulk email job to every employee in the payrun.
```

### CLIP 16
```
Here's Mailpit, our local email inbox for testing<break time="0.4s" /> — and there's the email that was just sent, complete with a real, generated PDF payslip attached.<break time="0.5s" /> This isn't a placeholder<break time="0.3s" /> — it's an actual rendered document going out through actual SMTP delivery.
```

### CLIP 17
```
Switching over to time off<break time="0.3s" /> — here's an employee's leave allocation.<break time="0.4s" /> It tracks how many days they've been allocated, how many they've already taken, and how many remain.
```

### CLIP 18
```
And here's a pending time-off request.<break time="0.4s" /> Approving it...
```
*(Leave 1-1.5s of silence after this while the click/loading happens on screen before Clip 19 starts.)*

### CLIP 19
```
...and if we jump back to the allocation view, you can see the remaining balance has already updated<break time="0.3s" /> — this happens atomically, so the balance is always accurate.
```

### CLIP 20
```
Now the reporting dashboard<break time="0.3s" /> — key metrics like total net salary paid, payslips generated, average salary, and attendance health, alongside a salary cost breakdown by department and a monthly net salary trend.
```

### CLIP 21
```
And these aren't static numbers.<break time="0.5s" /> Watch what happens when I change the period...<break time="0.6s" /> and the department filter...<break time="0.5s" /> every chart and every KPI updates live, straight from the database.
```
*(Leave a beat of silence around each ellipsis while the filter click/reload actually happens on screen.)*

### CLIP 22
```
As an Admin, there's also a full audit log<break time="0.3s" /> — every approval, validation, and creation action is tracked, along with who did it and when.
```

### CLIP 23
```
And an error log, for visibility into anything that goes wrong on the backend.
```

### CLIP 24
```
That's PeoplePay360<break time="0.4s" /> — a fully role-based, fully live, end-to-end HR and payroll platform.<break time="0.6s" /> Thanks for watching.
```

---

## Practical tips

- Generate all 24 clips first, listen through once for any mispronunciations (it may
  stumble on "PeoplePay360" — if so, try spelling it as "People Pay 3-60" in the
  input text just for that word, or use the pronunciation dictionary feature if your
  plan includes it).
- Line each clip's audio start against the matching numbered SHOW action above —
  pause your screen recording briefly at each transition point so the voiceover has
  room to breathe without racing the visuals.
- If a clip's break tags don't seem to render audibly in your output, that's
  model-dependent — just add the pause manually in your video editor between clips
  instead; the punctuation-driven pacing within each clip will still sound natural
  regardless.
- Rehearse the click-through once untimed before recording, then once with a
  stopwatch — the demo section (clips 7-19) is what tends to overrun.
