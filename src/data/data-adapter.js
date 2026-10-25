export async function loadSubmissions() {
  if (import.meta.env.DEV) {
    const response = await fetch(`${import.meta.env.BASE_URL}__local_snapshot`, {
      headers: { 'X-Local-Preview': 'snapshot' }, cache: 'no-store', credentials: 'omit',
    });
    if (response.ok) {
      const data = await response.json();
      if (!Array.isArray(data.runs) || data.source?.kind !== 'excel-snapshot') throw new Error('Invalid local snapshot.');
      return data;
    }
    if (response.status !== 404) throw new Error('Local snapshot access denied.');
  }
  const { demoSubmissions } = await import('./demo-data.js');
  return demoSubmissions();
}
