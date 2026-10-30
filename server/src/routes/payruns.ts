import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError } from '../lib/apiError';
import { writeAuditLog } from '../lib/audit';
import { getActiveContractForPeriod } from '../lib/contracts';
import { getWorkedDaysForPeriod } from '../lib/attendance';
import { computeSalaryRules } from '../lib/payroll/computeRules';
import { payslipSendQueue } from '../lib/payroll/queue';
import { processSendPayslipsJob } from '../lib/payroll/workers/sendPayslips';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createPayrunSchema = z.object({
  name: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  salaryStructureId: z.string(),
});

const attachEmployeesSchema = z.object({
  employeeIds: z.array(z.string()).min(1),
});

// Runs `fn` over `items` in sequential batches of `batchSize`, concurrently
// within each batch. Each payslip's compute step opens its own interactive
// $transaction; firing all of them at once via a single Promise.all against a
// 300+ employee payrun exhausts Prisma's connection pool and starts throwing
// "Unable to start a transaction in the given time." Batching bounds how many
// transactions are ever open at once, regardless of payrun size.
async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

// ---------------------------------------------------------------------------
// GET /api/payruns — list with payslip counts
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.get(
  '/',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (_req, res) => {
    const payruns = await prisma.payrun.findMany({
      include: {
        _count: { select: { payslips: true } },
        payslips: { select: { netSalary: true } },
      },
      orderBy: { periodStart: 'desc' },
    });
    const result = payruns.map(({ payslips, ...payrun }) => ({
      ...payrun,
      totalNet: payslips.reduce((sum, p) => sum + (p.netSalary ?? 0), 0),
    }));
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns — create payrun (Step 1 of wizard)
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const body = createPayrunSchema.parse(req.body);

    // Verify salary structure exists
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: body.salaryStructureId },
    });
    if (!structure) throw new ApiError(404, 'Salary structure not found');

    const payrun = await prisma.payrun.create({
      data: {
        name: body.name,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        salaryStructureId: body.salaryStructureId,
        status: 'draft',
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: 'CREATE_PAYRUN',
      entityType: 'Payrun',
      entityId: payrun.id,
      details: { name: payrun.name, periodStart: payrun.periodStart, periodEnd: payrun.periodEnd, status: payrun.status },
    });

    res.status(201).json(payrun);
  })
);

// ---------------------------------------------------------------------------
// GET /api/payruns/eligible-employees?periodStart=&periodEnd=
// Same period-aware eligibility check as :id/eligible-employees, usable during
// wizard Step 2 before a Payrun record exists yet. Registered before /:id so
// Express doesn't match "eligible-employees" as an :id path segment.
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
const eligibleEmployeesQuerySchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

router.get(
  '/eligible-employees',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const { periodStart, periodEnd } = eligibleEmployeesQuerySchema.parse(req.query);

    const allEmployees = await prisma.employee.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, department: true, bankAccountNumber: true },
    });

    const results = await Promise.all(
      allEmployees.map(async (emp) => {
        const contract = await getActiveContractForPeriod(
          emp.id,
          new Date(periodStart),
          new Date(periodEnd)
        );
        return contract
          ? { ...emp, contractId: contract.id, wage: contract.wage }
          : null;
      })
    );

    res.json(results.filter(Boolean));
  })
);

// ---------------------------------------------------------------------------
// GET /api/payruns/:id — single payrun with payslips
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// Response shape matches Contract 3 in INTEGRATION.md exactly
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: {
        salaryStructure: { select: { id: true, name: true } },
        payslips: {
          include: {
            employee: { select: { id: true, name: true, department: true } },
          },
          orderBy: { employee: { name: 'asc' } },
        },
      },
    });

    if (!payrun) throw new ApiError(404, 'Payrun not found');
    res.json(payrun);
  })
);

// ---------------------------------------------------------------------------
// GET /api/payruns/:id/eligible-employees
// Returns active employees that have a contract covering the payrun period
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.get(
  '/:id/eligible-employees',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new ApiError(404, 'Payrun not found');

    const allEmployees = await prisma.employee.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, department: true, bankAccountNumber: true },
    });

    // Check each employee's contract in parallel — Promise.all, not sequential loop
    const results = await Promise.all(
      allEmployees.map(async (emp) => {
        const contract = await getActiveContractForPeriod(
          emp.id,
          payrun.periodStart,
          payrun.periodEnd
        );
        return contract
          ? { ...emp, contractId: contract.id, wage: contract.wage }
          : null;
      })
    );

    res.json(results.filter(Boolean));
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns/:id/employees — attach employees (Step 2 of wizard)
// Creates draft Payslip stubs for selected employeeIds
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.post(
  '/:id/employees',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const id = req.params.id as string;
    const { employeeIds } = attachEmployeesSchema.parse(req.body);

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new ApiError(404, 'Payrun not found');
    if (payrun.status !== 'draft') {
      throw new ApiError(400, 'Can only attach employees to a draft payrun');
    }

    // Existing payslip employee IDs — skip duplicates
    const existing = await prisma.payslip.findMany({
      where: { payrunId: id },
      select: { employeeId: true },
    });
    const existingIds = new Set(existing.map((p) => p.employeeId));

    const toCreate = employeeIds.filter((empId) => !existingIds.has(empId));

    // Resolve contracts in parallel first (plain reads — no transaction needed),
    // then insert every payslip stub in one batched write. Looping one employee
    // at a time inside a single interactive $transaction blew past Prisma's
    // default 5s transaction timeout once the seed data grew to 300+ employees.
    const contracts = await Promise.all(
      toCreate.map((employeeId) =>
        getActiveContractForPeriod(employeeId, payrun.periodStart, payrun.periodEnd).then(
          (contract) => ({ employeeId, contract })
        )
      )
    );

    const rows = contracts
      // Skip employees without an active contract — will be reported as skipped
      .filter((r): r is { employeeId: string; contract: NonNullable<typeof r.contract> } => !!r.contract)
      .map((r) => ({
        payrunId: id,
        employeeId: r.employeeId,
        contractId: r.contract.id,
        workedDays: 0,
        status: 'draft',
        warnings: [] as string[],
      }));

    if (rows.length > 0) {
      await prisma.payslip.createMany({ data: rows });
    }
    const created = rows.map((r) => r.employeeId);

    await writeAuditLog({
      userId: session.userId,
      action: 'ATTACH_EMPLOYEES',
      entityType: 'Payrun',
      entityId: id,
      details: { added: created.length, skipped: toCreate.length - created.length },
    });

    res.status(201).json({
      added: created.length,
      skipped: toCreate.length - created.length,
      alreadyAttached: employeeIds.length - toCreate.length,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns/:id/compute — run the rule engine for all payslips
// Roles: HR_PAYROLL_USER, HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.post(
  '/:id/compute',
  requireAuth,
  requireRole(['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const id = req.params.id as string;

    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: {
        salaryStructure: { include: { rules: { orderBy: { sequence: 'asc' } } } },
        payslips: { include: { employee: true } },
      },
    });

    if (!payrun) throw new ApiError(404, 'Payrun not found');
    if (payrun.status === 'paid' || payrun.status === 'validated') {
      throw new ApiError(400, `Cannot recompute a ${payrun.status} payrun`);
    }

    // Duplicate-payslip check — an employee already validated/paid in a *different*
    // payrun whose period overlaps this one would otherwise be silently paid twice
    // for the same period, with no warning. One batched query for the whole payrun.
    const employeeIds = (payrun as any).payslips.map((p: any) => p.employeeId);
    const overlappingPayslips = await prisma.payslip.findMany({
      where: {
        employeeId: { in: employeeIds },
        payrunId: { not: id },
        status: { in: ['validated', 'paid'] },
        payrun: {
          periodStart: { lte: payrun.periodEnd },
          periodEnd: { gte: payrun.periodStart },
        },
      },
      select: { employeeId: true, payrunId: true, payrun: { select: { name: true } } },
    });
    const duplicateByEmployee = new Map<string, string>();
    for (const p of overlappingPayslips) {
      duplicateByEmployee.set(p.employeeId, p.payrun.name);
    }

    // Process payslips in controlled batches of 15 to avoid DB pool exhaustion / transaction timeouts on large payruns
    const updates: Array<{ skipped: boolean; employeeId: string; netSalary?: number }> = [];
    const payslipList = (payrun as any).payslips;
    const chunkSize = 15;

    for (let i = 0; i < payslipList.length; i += chunkSize) {
      const chunk = payslipList.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (payslip: any) => {
          const warnings: string[] = [];

          const duplicatePayrunName = duplicateByEmployee.get(payslip.employeeId);
          if (duplicatePayrunName) {
            warnings.push(
              `duplicate payslip — employee already has a validated/paid payslip for an overlapping period in "${duplicatePayrunName}"`
            );
          }

          // 1. Resolve the period-correct contract
          const contract = await getActiveContractForPeriod(
            payslip.employeeId,
            payrun.periodStart,
            payrun.periodEnd
          );

          if (!contract) {
            warnings.push('no active contract for period — payslip skipped');
            await prisma.payslip.update({
              where: { id: payslip.id },
              data: { warnings, status: 'draft' },
            });
            return { skipped: true, employeeId: payslip.employeeId };
          }

          // 2. Build base context
          const workedDays = await getWorkedDaysForPeriod(
            payslip.employeeId,
            payrun.periodStart,
            payrun.periodEnd
          );

          const baseContext: Record<string, number> = {
            CONTRACT_WAGE: contract.wage,
            WORKED_DAYS: workedDays,
          };

          // 3. Run the rule engine (uses contract's structure rules, not payrun's — period-correct)
          const {
            lines,
            scope,
            warnings: ruleWarnings,
          } = computeSalaryRules(
            contract.salaryStructure.rules.map((r: any) => ({
              ...r,
              computationMethod: r.computationMethod as 'fixed' | 'percentage' | 'formula',
            })),
            baseContext
          );
          warnings.push(...ruleWarnings);

          // 4. Warn if bank details missing
          if (!payslip.employee.bankAccountNumber) {
            warnings.push('missing bank details — cannot process payment');
          }

          // 5. Find net salary
          const netLine = lines.find((l) => l.category === 'Net');
          const netSalary = netLine?.amount ?? scope['NET'] ?? 0;

          // 6. Delete old lines and create new ones (enables recompute on draft payslips)
          //    This is the key pattern for the live-demo "edit rule → recompute" flow
          await prisma.$transaction(async (tx) => {
            await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
            await tx.payslipLine.createMany({
              data: lines.map((l) => ({ ...l, payslipId: payslip.id })),
            });
            await tx.payslip.update({
              where: { id: payslip.id },
              data: {
                contractId: contract.id,
                workedDays,
                netSalary,
                warnings,
                status: 'computed',
              },
            });
          });

          return { skipped: false, employeeId: payslip.employeeId, netSalary };
        })
      );
      updates.push(...chunkResults);
    }

    for (let i = 0; i < payslipList.length; i += chunkSize) {
      const chunk = payslipList.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (payslip: any) => {
          const warnings: string[] = [];

          const duplicatePayrunName = duplicateByEmployee.get(payslip.employeeId);
          if (duplicatePayrunName) {
            warnings.push(
              `duplicate payslip — employee already has a validated/paid payslip for an overlapping period in "${duplicatePayrunName}"`
            );
          }

          // 1. Resolve the period-correct contract
          const contract = await getActiveContractForPeriod(
            payslip.employeeId,
            payrun.periodStart,
            payrun.periodEnd
          );

          if (!contract) {
            warnings.push('no active contract for period — payslip skipped');
            await prisma.payslip.update({
              where: { id: payslip.id },
              data: { warnings, status: 'draft' },
            });
            return { skipped: true, employeeId: payslip.employeeId };
          }

          // 2. Build base context
          const workedDays = await getWorkedDaysForPeriod(
            payslip.employeeId,
            payrun.periodStart,
            payrun.periodEnd
          );

          const baseContext: Record<string, number> = {
            CONTRACT_WAGE: contract.wage,
            WORKED_DAYS: workedDays,
          };

          // 3. Run the rule engine
          const {
            lines,
            scope,
            warnings: ruleWarnings,
          } = computeSalaryRules(
            contract.salaryStructure.rules.map((r: any) => ({
              ...r,
              computationMethod: r.computationMethod as 'fixed' | 'percentage' | 'formula',
            })),
            baseContext
          );
          warnings.push(...ruleWarnings);

          // 4. Warn if bank details missing
          if (!payslip.employee.bankAccountNumber) {
            warnings.push('missing bank details — cannot process payment');
          }

          // 5. Find net salary
          const netLine = lines.find((l) => l.category === 'Net');
          const netSalary = netLine?.amount ?? scope['NET'] ?? 0;

          // 6. Update lines and payslip in a transaction
          await prisma.$transaction(async (tx) => {
            await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
            await tx.payslipLine.createMany({
              data: lines.map((l) => ({ ...l, payslipId: payslip.id })),
            });
            await tx.payslip.update({
              where: { id: payslip.id },
              data: {
                contractId: contract.id,
                workedDays,
                netSalary,
                warnings,
                status: 'computed',
              },
            });
          });

<<<<<<< Updated upstream
          return { skipped: false, employeeId: payslip.employeeId, netSalary };
        })
      );
      updates.push(...chunkResults);
    }
=======
        // 2. Build base context
        const workedDays = await getWorkedDaysForPeriod(
          payslip.employeeId,
          payrun.periodStart,
          payrun.periodEnd
        );

        const baseContext: Record<string, number> = {
          CONTRACT_WAGE: contract.wage,
          WORKED_DAYS: workedDays,
        };

        // 3. Run the rule engine (uses contract's structure rules, not payrun's — period-correct)
        const {
          lines,
          scope,
          warnings: ruleWarnings,
        } = computeSalaryRules(
          contract.salaryStructure.rules.map((r: any) => ({
            ...r,
            computationMethod: r.computationMethod as 'fixed' | 'percentage' | 'formula',
          })),
          baseContext
        );
        warnings.push(...ruleWarnings);

        // 4. Warn if bank details missing
        if (!payslip.employee.bankAccountNumber) {
          warnings.push('missing bank details — cannot process payment');
        }

        // 5. Find net salary
        const netLine = lines.find((l) => l.category === 'Net');
        const netSalary = netLine?.amount ?? scope['NET'] ?? 0;

        // 6. Delete old lines and create new ones (enables recompute on draft payslips)
        //    This is the key pattern for the live-demo "edit rule → recompute" flow
        await prisma.$transaction(async (tx) => {
          await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
          await tx.payslipLine.createMany({
            data: lines.map((l) => ({ ...l, payslipId: payslip.id })),
          });
          await tx.payslip.update({
            where: { id: payslip.id },
            data: {
              contractId: contract.id,
              workedDays,
              netSalary,
              warnings,
              status: 'computed',
            },
          });
        });

        return { skipped: false, employeeId: payslip.employeeId, netSalary };
      }
    );
>>>>>>> Stashed changes

    await prisma.payrun.update({
      where: { id },
      data: { status: 'computed' },
    });

    await writeAuditLog({
      userId: session.userId,
      action: 'COMPUTE_PAYRUN',
      entityType: 'Payrun',
      entityId: id,
      details: { status: 'computed', computedCount: updates.filter((u: any) => !u.skipped).length },
    });

    res.json({
      computed: updates.filter((u: any) => !u.skipped).length,
      skipped: updates.filter((u: any) => u.skipped).length,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns/:id/validate
// Roles: HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.post(
  '/:id/validate',
  requireAuth,
  requireRole(['HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const id = req.params.id as string;

    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: { payslips: true },
    });
    if (!payrun) throw new ApiError(404, 'Payrun not found');

    if (payrun.status !== 'computed') {
      throw new ApiError(400, `Payrun must be in 'computed' status to validate (current: ${payrun.status})`);
    }

    // Block if any payslip has a blocking warning
    const blockingWarnings: string[] = [];
    for (const payslip of (payrun as any).payslips) {
      for (const w of payslip.warnings) {
        if (w.includes('skipped') || w.includes('missing bank details') || w.includes('duplicate payslip')) {
          blockingWarnings.push(`Employee ${payslip.employeeId}: ${w}`);
        }
      }
    }

    // Re-check for duplicates live, rather than trusting warnings stored at
    // compute time — another payrun may have been validated/paid for the same
    // employee/period since this one was last computed.
    const employeeIds = (payrun as any).payslips.map((p: any) => p.employeeId);
    const overlappingPayslips = await prisma.payslip.findMany({
      where: {
        employeeId: { in: employeeIds },
        payrunId: { not: id },
        status: { in: ['validated', 'paid'] },
        payrun: {
          periodStart: { lte: payrun.periodEnd },
          periodEnd: { gte: payrun.periodStart },
        },
      },
      select: { employeeId: true, payrun: { select: { name: true } } },
    });
    for (const p of overlappingPayslips) {
      blockingWarnings.push(
        `Employee ${p.employeeId}: duplicate payslip — employee already has a validated/paid payslip for an overlapping period in "${p.payrun.name}"`
      );
    }

    if (blockingWarnings.length > 0) {
      throw new ApiError(
        400,
        `Payrun has blocking warnings that must be resolved before validation: ${blockingWarnings.join('; ')}`
      );
    }

    // Set all payslips and the payrun to 'validated'
    await prisma.$transaction([
      prisma.payslip.updateMany({
        where: { payrunId: id },
        data: { status: 'validated' },
      }),
      prisma.payrun.update({
        where: { id },
        data: { status: 'validated' },
      }),
    ]);

    await writeAuditLog({
      userId: session.userId,
      action: 'VALIDATE_PAYRUN',
      entityType: 'Payrun',
      entityId: id,
      details: { status: 'validated', name: payrun.name },
    });

    res.json({ message: 'Payrun validated' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns/:id/mark-paid
// Roles: HR_PAYROLL_MANAGER, ADMIN
// ---------------------------------------------------------------------------
router.post(
  '/:id/mark-paid',
  requireAuth,
  requireRole(['HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const id = req.params.id as string;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new ApiError(404, 'Payrun not found');

    if (payrun.status !== 'validated') {
      throw new ApiError(400, `Payrun must be in 'validated' status to mark as paid (current: ${payrun.status})`);
    }

    await prisma.$transaction([
      prisma.payslip.updateMany({
        where: { payrunId: id },
        data: { status: 'paid' },
      }),
      prisma.payrun.update({
        where: { id },
        data: { status: 'paid' },
      }),
    ]);

    await writeAuditLog({
      userId: session.userId,
      action: 'MARK_PAID',
      entityType: 'Payrun',
      entityId: id,
      details: { status: 'paid', name: payrun.name },
    });

    res.json({ message: 'Payrun marked as paid' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/payruns/:id/send-payslips — enqueue BullMQ job
// Roles: HR_PAYROLL_MANAGER, ADMIN
// Returns 503 (not 500) if Redis is unreachable
// ---------------------------------------------------------------------------
router.post(
  '/:id/send-payslips',
  requireAuth,
  requireRole(['HR_PAYROLL_MANAGER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const id = req.params.id as string;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new ApiError(404, 'Payrun not found');

    try {
      await payslipSendQueue.add('send', {
        payrunId: id,
        requestedByUserId: session.userId,
      });
      return res.json({ message: 'Payslip send job queued' });
    } catch (err) {
      console.warn('[Send Payslips] Queue enqueue failed, fallback to inline execution:', (err as Error).message);
      const result = await processSendPayslipsJob({
        payrunId: id,
        requestedByUserId: session.userId,
      });
      return res.json({ message: `Payslips sent inline (${result.sent} delivered)` });
    }
  })
);

export default router;
