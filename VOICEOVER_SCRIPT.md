# PeoplePay360 — Voiceover Script (ElevenLabs)

24 clips. Generate each as its own separate audio file rather than one giant block —
easier to sync to the screen action, and easier to redo a single line if one take
comes out wrong.

---

### CLIP 1
```
This is PeoplePay360<break time="0.4s" /> — an integrated HR and payroll platform.<break time="0.6s" /> Employees sit at the center of the system, with contracts, work schedules, attendance, and time off all feeding into payroll<break time="0.3s" /> — and payroll itself is driven by configurable salary rules, not hardcoded numbers.<break time="0.6s" /> The platform supports five distinct user roles, each with its own permissions, enforced not just in the interface, but on the backend as well.
```

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
