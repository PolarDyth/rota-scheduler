import type { Department, Employee, Hour, JobId } from '../types';
import { GENERAL_JOBS } from './jobs';

export function swapFittingRoomsFromGeneral(
  job: JobId,
  hour: Hour,
  employees: Employee[],
  assignedThisHour: Map<string, JobId>,
  hourlyAssignments: Record<Hour, Record<string, JobId>>,
  assignmentOrder: Record<Hour, Partial<Record<JobId, string[]>>>,
  singleHeadEligible: Set<string>
) {
  if (job !== 'fittingMens' && job !== 'fittingWomens') return;
  const requiredDept: Department = job === 'fittingMens' ? 'menswear' : 'womenswear';

  const placedIds = assignmentOrder[hour][job] ?? [];
  for (const placedId of placedIds) {
    const placed = employees.find((e) => e.id === placedId);
    if (!placed) continue;
    if (placed.department === requiredDept || placed.department === 'any') continue;

    const swapTarget = employees.find((e) => {
      if (e.department !== requiredDept) return false;
      const currentJob = assignedThisHour.get(e.id);
      if (!currentJob || !GENERAL_JOBS.includes(currentJob)) return false;
      if (!singleHeadEligible.has(e.id)) return false;
      return true;
    });

    if (swapTarget) {
      const oldJob = assignedThisHour.get(swapTarget.id)!;
      assignedThisHour.set(swapTarget.id, job);
      assignedThisHour.set(placed.id, oldJob);
      hourlyAssignments[hour][swapTarget.id] = job;
      hourlyAssignments[hour][placed.id] = oldJob;

      const fittingList = assignmentOrder[hour][job] ?? [];
      const idx = fittingList.indexOf(placedId);
      if (idx >= 0) fittingList[idx] = swapTarget.id;
      assignmentOrder[hour][job] = fittingList;

      const oldJobList = assignmentOrder[hour][oldJob] ?? [];
      const oldIdx = oldJobList.indexOf(swapTarget.id);
      if (oldIdx >= 0) oldJobList[oldIdx] = placed.id;
      assignmentOrder[hour][oldJob] = oldJobList;
    }
  }
}
