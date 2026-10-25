export const statuses = ['New', 'In Progress', 'Accepted', 'Accepted (Not announced)', 'Rejected'];
export const completedStatuses = ['Accepted', 'Accepted (Not announced)', 'Rejected'];
export const isCompleted = run => completedStatuses.includes(run.status);
export const checkerNames = runs => [...new Set(runs.map(run => run.checker).filter(value => value.trim()))].sort((a,b) => a.localeCompare(b));
export function selectRuns(runs, filters) {
  const selected = runs.filter(run => run.runner.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase().trim()) && ['game','tier'].every(key => !filters[key] || run[key] === filters[key]) && (!filters.status || (filters.status === '__completed' ? isCompleted(run) : run.status === filters.status)) && (!filters.checker || (filters.checker === '__unassigned' ? !run.checker.trim() : run.checker === filters.checker)));
  return selected.sort((a,b) => {
    if (!a.submitted) return b.submitted ? 1 : a.id.localeCompare(b.id);
    if (!b.submitted) return -1;
    return (filters.sort === 'oldest' ? a.submitted.localeCompare(b.submitted) : b.submitted.localeCompare(a.submitted)) || a.id.localeCompare(b.id);
  });
}
export function summarize(runs) {
  const games = {}, byStatus = Object.fromEntries(statuses.map(status => [status, 0])), checkers = {};
  for (const run of runs) {
    games[run.game] = (games[run.game] || 0) + 1;
    byStatus[run.status] = (byStatus[run.status] || 0) + 1;
    if (isCompleted(run)) {
      const checker = run.checker.trim() ? run.checker : '(Not recorded)';
      checkers[checker] = (checkers[checker] || 0) + 1;
    }
  }
  return { games, byStatus, checkers, completed: runs.filter(isCompleted).length };
}
